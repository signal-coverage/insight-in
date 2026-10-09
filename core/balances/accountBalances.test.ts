import { beforeEach, describe, expect, it, vi } from "vitest";

// accountBalances reads the opening through ./service, which imports the real db client.
vi.mock("@/infrastructure/db/client", () => ({ prisma: {} }));

import { readAccountBalances } from "./accountBalances";

const USER_ID = "user_123";

const fakeDb = () => ({
  openingBalance: { findMany: vi.fn().mockResolvedValue([]) },
  income: { groupBy: vi.fn().mockResolvedValue([]) },
  expense: { groupBy: vi.fn().mockResolvedValue([]) },
  transfer: { groupBy: vi.fn().mockResolvedValue([]) },
  account: { findMany: vi.fn().mockResolvedValue([]) },
});

// A transfer group is keyed by the side it was grouped by.
const outGroup = (accountId: string, amount: number) => ({
  fromAccountId: accountId,
  _sum: { amount: BigInt(amount) },
});
const inGroup = (accountId: string, amount: number) => ({
  toAccountId: accountId,
  _sum: { amount: BigInt(amount) },
});

const group = (accountId: string, currency: string, amount: number) => ({
  accountId,
  currency,
  _sum: { amount: BigInt(amount) },
});

const openingRow = (
  accountId: string,
  currency: string,
  amount: number,
  month = "2026-06",
) => ({
  id: `ob_${accountId}`,
  userId: USER_ID,
  accountId,
  account: { currency },
  amount: BigInt(amount),
  month,
});

let db: ReturnType<typeof fakeDb>;

beforeEach(() => {
  db = fakeDb();
});

describe("readAccountBalances", () => {
  it("sums only the user's settled entries, grouped by account, with no upper date", async () => {
    await readAccountBalances(db as never, USER_ID);

    for (const table of [db.income, db.expense]) {
      expect(table.groupBy).toHaveBeenCalledWith({
        by: ["accountId", "currency"],
        where: { userId: USER_ID, status: "SETTLED" },
        _sum: { amount: true },
      });
    }
  });

  it("starts at the first day of the opening month when there is an opening balance", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);

    await readAccountBalances(db as never, USER_ID);

    expect(db.income.groupBy.mock.calls[0][0].where.date).toEqual({
      gte: new Date("2026-06-01T00:00:00.000Z"),
    });
  });

  it("is the opening amount plus the settled incomes minus the settled expenses, per account", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
    ]);
    db.income.groupBy.mockResolvedValue([group("acc_bank", "ARS", 2000)]);
    db.expense.groupBy.mockResolvedValue([
      group("acc_bank", "ARS", 500),
      group("acc_cash", "ARS", 300),
    ]);

    expect(await readAccountBalances(db as never, USER_ID)).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 6500 },
      { accountId: "acc_cash", currency: "ARS", balance: -300 },
    ]);
  });

  it("can be narrowed to some accounts, keeping the user's opening month for all of them", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000),
      openingRow("acc_other", "ARS", 999),
    ]);

    const balances = await readAccountBalances(db as never, USER_ID, [
      "acc_bank",
    ]);

    expect(db.expense.groupBy.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      status: "SETTLED",
      accountId: { in: ["acc_bank"] },
      date: { gte: new Date("2026-06-01T00:00:00.000Z") },
    });
    expect(balances).toEqual([
      { accountId: "acc_bank", currency: "ARS", balance: 5000 },
    ]);
  });

  it("ignores planned and covered entries: only SETTLED is ever read", async () => {
    await readAccountBalances(db as never, USER_ID);

    expect(db.income.groupBy.mock.calls[0][0].where.status).toBe("SETTLED");
    expect(db.expense.groupBy.mock.calls[0][0].where.status).toBe("SETTLED");
  });

  describe("transfers", () => {
    it("reads the user's transfers grouped by each side, with no upper date", async () => {
      await readAccountBalances(db as never, USER_ID);

      expect(db.transfer.groupBy).toHaveBeenCalledWith({
        by: ["fromAccountId"],
        where: { userId: USER_ID },
        _sum: { amount: true },
      });
      expect(db.transfer.groupBy).toHaveBeenCalledWith({
        by: ["toAccountId"],
        where: { userId: USER_ID },
        _sum: { amount: true },
      });
    });

    it("takes the money out of the source and into the destination, in the currency of the accounts", async () => {
      db.openingBalance.findMany.mockResolvedValue([
        openingRow("acc_bank", "ARS", 5000),
      ]);
      db.transfer.groupBy.mockImplementation(
        async ({ by }: { by: string[] }) =>
          by[0] === "fromAccountId"
            ? [outGroup("acc_bank", 1200)]
            : [inGroup("acc_cash", 1200)],
      );
      db.account.findMany.mockResolvedValue([
        { id: "acc_bank", currency: "ARS" },
        { id: "acc_cash", currency: "ARS" },
      ]);

      expect(await readAccountBalances(db as never, USER_ID)).toEqual([
        { accountId: "acc_bank", currency: "ARS", balance: 3800 },
        { accountId: "acc_cash", currency: "ARS", balance: 1200 },
      ]);
      expect(db.account.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, id: { in: ["acc_bank", "acc_cash"] } },
        select: { id: true, currency: true },
      });
    });

    it("shows an account that only has transfers", async () => {
      db.transfer.groupBy.mockImplementation(
        async ({ by }: { by: string[] }) =>
          by[0] === "toAccountId" ? [inGroup("acc_new", 700)] : [],
      );
      db.account.findMany.mockResolvedValue([
        { id: "acc_new", currency: "USD" },
      ]);

      expect(await readAccountBalances(db as never, USER_ID)).toEqual([
        { accountId: "acc_new", currency: "USD", balance: 700 },
      ]);
    });

    it("does not look the accounts up when there is no transfer", async () => {
      await readAccountBalances(db as never, USER_ID);

      expect(db.account.findMany).not.toHaveBeenCalled();
    });

    it("counts transfers from the first day of the opening month, like the entries", async () => {
      db.openingBalance.findMany.mockResolvedValue([
        openingRow("acc_bank", "ARS", 5000),
      ]);

      await readAccountBalances(db as never, USER_ID);

      expect(db.transfer.groupBy).toHaveBeenCalledTimes(2);
      for (const call of db.transfer.groupBy.mock.calls) {
        expect(call[0].where.date).toEqual({
          gte: new Date("2026-06-01T00:00:00.000Z"),
        });
      }
    });

    it("narrows each side to the accounts asked for", async () => {
      await readAccountBalances(db as never, USER_ID, ["acc_bank"]);

      expect(db.transfer.groupBy).toHaveBeenCalledWith({
        by: ["fromAccountId"],
        where: { userId: USER_ID, fromAccountId: { in: ["acc_bank"] } },
        _sum: { amount: true },
      });
      expect(db.transfer.groupBy).toHaveBeenCalledWith({
        by: ["toAccountId"],
        where: { userId: USER_ID, toAccountId: { in: ["acc_bank"] } },
        _sum: { amount: true },
      });
    });
  });

  describe("asOf", () => {
    it("counts every kind of movement up to that day, both ends included", async () => {
      await readAccountBalances(db as never, USER_ID, ["acc_bank"], {
        asOf: "2026-09-15",
      });

      const upTo = { lte: new Date("2026-09-15T00:00:00.000Z") };

      expect(db.income.groupBy.mock.calls[0][0].where.date).toEqual(upTo);
      expect(db.expense.groupBy.mock.calls[0][0].where.date).toEqual(upTo);
      expect(db.transfer.groupBy).toHaveBeenCalledTimes(2);
      for (const call of db.transfer.groupBy.mock.calls) {
        expect(call[0].where.date).toEqual(upTo);
      }
    });

    it("keeps the opening month as the lower bound when there is an opening balance that has started", async () => {
      db.openingBalance.findMany.mockResolvedValue([
        openingRow("acc_bank", "ARS", 5000),
      ]);

      const balances = await readAccountBalances(
        db as never,
        USER_ID,
        ["acc_bank"],
        { asOf: "2026-06-01" },
      );

      const bounds = {
        gte: new Date("2026-06-01T00:00:00.000Z"),
        lte: new Date("2026-06-01T00:00:00.000Z"),
      };

      expect(db.income.groupBy.mock.calls[0][0].where.date).toEqual(bounds);
      expect(db.transfer.groupBy).toHaveBeenCalledTimes(2);
      for (const call of db.transfer.groupBy.mock.calls) {
        expect(call[0].where.date).toEqual(bounds);
      }
      expect(balances).toEqual([
        { accountId: "acc_bank", currency: "ARS", balance: 5000 },
      ]);
    });

    it("holds nothing before the opening month began: no balance is invented, and nothing is queried", async () => {
      db.openingBalance.findMany.mockResolvedValue([
        openingRow("acc_bank", "ARS", 5000),
      ]);

      const balances = await readAccountBalances(
        db as never,
        USER_ID,
        ["acc_bank"],
        { asOf: "2026-05-31" },
      );

      expect(balances).toEqual([]);
      expect(db.income.groupBy).not.toHaveBeenCalled();
      expect(db.expense.groupBy).not.toHaveBeenCalled();
      expect(db.transfer.groupBy).not.toHaveBeenCalled();
    });

    it("without an opening balance only the upper bound applies", async () => {
      db.income.groupBy.mockResolvedValue([group("acc_bank", "ARS", 900)]);

      const balances = await readAccountBalances(
        db as never,
        USER_ID,
        undefined,
        { asOf: "2026-01-01" },
      );

      expect(balances).toEqual([
        { accountId: "acc_bank", currency: "ARS", balance: 900 },
      ]);
    });
  });

  describe("excludeTransferId", () => {
    it("leaves that transfer out of both sides, so an edit never counts against itself", async () => {
      await readAccountBalances(db as never, USER_ID, ["acc_bank"], {
        excludeTransferId: "tr_1",
      });

      expect(db.transfer.groupBy).toHaveBeenCalledTimes(2);
      for (const call of db.transfer.groupBy.mock.calls) {
        expect(call[0].where.id).toEqual({ not: "tr_1" });
      }
      expect(db.income.groupBy.mock.calls[0][0].where.id).toBeUndefined();
    });
  });

  describe("excludeExpenseId", () => {
    it("leaves that expense out of the expenses only, so an edit never counts against itself", async () => {
      await readAccountBalances(db as never, USER_ID, ["acc_bank"], {
        excludeExpenseId: "exp_1",
      });

      expect(db.expense.groupBy.mock.calls[0][0].where.id).toEqual({
        not: "exp_1",
      });
      expect(db.income.groupBy.mock.calls[0][0].where.id).toBeUndefined();
      expect(db.transfer.groupBy).toHaveBeenCalledTimes(2);
      for (const call of db.transfer.groupBy.mock.calls) {
        expect(call[0].where.id).toBeUndefined();
      }
    });

    it("counts every expense when none is left out", async () => {
      await readAccountBalances(db as never, USER_ID, ["acc_bank"]);

      expect(db.expense.groupBy.mock.calls[0][0].where.id).toBeUndefined();
    });
  });
});
