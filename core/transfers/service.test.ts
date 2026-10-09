import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  transfer: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  account: { findFirst: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));
const transferLocks = vi.hoisted(() => ({ lockTransfers: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/balances/accountBalances", () => balances);
vi.mock("./locks", () => transferLocks);

import {
  TransferAccountError,
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";
import {
  createTransfer,
  deleteTransfer,
  deleteTransfers,
  listTransfers,
  updateTransfer,
} from "./service";

const USER_ID = "user_123";
const TODAY = "2026-10-06";
const OLD = new Date("2026-09-01T00:00:00.000Z");

const ACCOUNTS: Record<
  string,
  { id: string; currency: string; archivedAt: Date | null }
> = {
  acc_a: { id: "acc_a", currency: "ARS", archivedAt: null },
  acc_b: { id: "acc_b", currency: "ARS", archivedAt: null },
  acc_c: { id: "acc_c", currency: "ARS", archivedAt: null },
  acc_usd: { id: "acc_usd", currency: "USD", archivedAt: null },
  acc_usdc: { id: "acc_usdc", currency: "USDC", archivedAt: null },
  acc_usdc2: { id: "acc_usdc2", currency: "USDC", archivedAt: null },
  acc_usdt: { id: "acc_usdt", currency: "USDT", archivedAt: null },
  acc_old: { id: "acc_old", currency: "ARS", archivedAt: OLD },
};

const INPUT = {
  currency: "ARS",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  amount: 5000,
  date: TODAY,
  notes: null,
};

// What each account holds, whichever accounts and day the reader is asked about. An account that is
// not in the map has no balance row (it holds nothing).
const held = (byAccount: Record<string, number>) =>
  balances.readAccountBalances.mockImplementation(
    async (_tx: unknown, _userId: string, ids?: string[]) =>
      (ids ?? [])
        .filter((id) => id in byAccount)
        .map((id) => ({
          accountId: id,
          currency: "ARS",
          balance: byAccount[id],
        })),
  );

// The source's balance on the day asked (any read with `asOf`) and now (a read without it).
const heldOnAndNow = (onDate: number, now: number) =>
  balances.readAccountBalances.mockImplementation(
    async (
      _tx: unknown,
      _userId: string,
      ids?: string[],
      options?: { asOf?: string },
    ) =>
      (ids ?? []).map((id) => ({
        accountId: id,
        currency: "ARS",
        balance: options?.asOf ? onDate : now,
      })),
  );

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  db.$queryRaw.mockImplementation(
    async (_strings: TemplateStringsArray, id: string) =>
      ACCOUNTS[id] ? [ACCOUNTS[id]] : [],
  );
  db.account.findFirst.mockResolvedValue({
    name: "Efectivo",
    bank: { name: "Efectivo" },
  });
  db.transfer.create.mockResolvedValue({});
  db.transfer.updateMany.mockResolvedValue({ count: 1 });
  db.transfer.deleteMany.mockResolvedValue({ count: 1 });
  transferLocks.lockTransfers.mockResolvedValue(undefined);
  held({ acc_a: 10000, acc_b: 10000, acc_c: 10000 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createTransfer", () => {
  it("refuses a USDC transfer to a USDT account and accepts one between USDC accounts", async () => {
    const usdc = { ...INPUT, currency: "USDC", fromAccountId: "acc_usdc" };

    await expect(
      createTransfer(USER_ID, { ...usdc, toAccountId: "acc_usdt" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "CURRENCY_MISMATCH"));
    expect(db.transfer.create).not.toHaveBeenCalled();

    held({ acc_usdc: 10000 });
    await createTransfer(USER_ID, { ...usdc, toAccountId: "acc_usdc2" }, TODAY);
    expect(db.transfer.create).toHaveBeenCalledTimes(1);
  });

  it("locks both accounts, reads the source's funds as of the transfer date and now, then creates, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [ACCOUNTS[id]];
      },
    );
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("funds");

      return [{ accountId: "acc_a", currency: "ARS", balance: 10000 }];
    });
    db.transfer.create.mockImplementation(async () => {
      order.push("create");

      return {};
    });

    await createTransfer(USER_ID, { ...INPUT, date: "2026-09-20" }, TODAY);

    expect(order).toEqual([
      "lock acc_a",
      "lock acc_b",
      "funds",
      "funds",
      "create",
    ]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_a"],
      { asOf: "2026-09-20", excludeTransferId: undefined },
    );
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_a"],
      { excludeTransferId: undefined },
    );
  });

  it("only asks about the source: the destination merely gains, so it is never checked", async () => {
    await createTransfer(USER_ID, INPUT, TODAY);

    // The source on the transfer date and the source now: nothing else.
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(2);
    for (const call of balances.readAccountBalances.mock.calls) {
      expect(call[2]).toEqual(["acc_a"]);
    }
  });

  it("locks the lower id first even when the source has the higher one (A to B and B to A never deadlock)", async () => {
    held({ acc_b: 9000 });

    await createTransfer(
      USER_ID,
      { ...INPUT, fromAccountId: "acc_b", toAccountId: "acc_a" },
      TODAY,
    );

    expect(db.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
    ]);
  });

  it("creates with an explicit field list: the owner comes from the session, never from the payload", async () => {
    await createTransfer(
      USER_ID,
      { ...INPUT, notes: "Alquiler", userId: "attacker", id: "x" } as never,
      TODAY,
    );

    expect(db.transfer.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        fromAccountId: "acc_a",
        toAccountId: "acc_b",
        amount: BigInt(5000),
        date: new Date("2026-10-06T00:00:00.000Z"),
        notes: "Alquiler",
      },
    });
  });

  it("accepts exactly the funds the source holds", async () => {
    held({ acc_a: 5000 });

    await expect(
      createTransfer(USER_ID, INPUT, TODAY),
    ).resolves.toBeUndefined();
  });

  it.each([[4999], [0], [-300], [null]])(
    "refuses when the source held %s on that day, and creates nothing",
    async (balance) => {
      held(balance === null ? {} : { acc_a: balance });

      const error = await createTransfer(USER_ID, INPUT, TODAY).catch(
        (thrown) => thrown,
      );

      expect(error).toBeInstanceOf(TransferInsufficientFundsError);
      expect(error.available).toBe(balance ?? 0);
      expect(error.currency).toBe("ARS");
      expect(db.transfer.create).not.toHaveBeenCalled();
    },
  );

  it("asks for the balance of the transfer date, never of today (a backdated transfer on an account that was empty then)", async () => {
    held({ acc_a: 0 });

    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-03-01" }, TODAY),
    ).rejects.toBeInstanceOf(TransferInsufficientFundsError);
    expect(balances.readAccountBalances.mock.calls[0][3]).toEqual({
      asOf: "2026-03-01",
      excludeTransferId: undefined,
    });
  });

  it("refuses a backdated transfer when the source holds less NOW, even if it held enough on that date, and creates nothing (it would end below zero)", async () => {
    // Income of 10,00 on the 1st, expense of 10,00 on the 5th: 10,00 on the 2nd, nothing now.
    heldOnAndNow(1000, 0);

    const error = await createTransfer(
      USER_ID,
      { ...INPUT, amount: 1000, date: "2026-10-02" },
      TODAY,
    ).catch((thrown) => thrown);

    expect(error).toBeInstanceOf(TransferInsufficientFundsError);
    expect(error.available).toBe(0);
    expect(error.currency).toBe("ARS");
    expect(db.transfer.create).not.toHaveBeenCalled();
  });

  it("names the lower of the two balances when it refuses", async () => {
    heldOnAndNow(300, 1000);

    await expect(
      createTransfer(
        USER_ID,
        { ...INPUT, amount: 1000, date: "2026-10-02" },
        TODAY,
      ),
    ).rejects.toMatchObject({ available: 300 });

    heldOnAndNow(1000, 300);

    await expect(
      createTransfer(
        USER_ID,
        { ...INPUT, amount: 1000, date: "2026-10-02" },
        TODAY,
      ),
    ).rejects.toMatchObject({ available: 300 });
  });

  it.each([
    ["both balances cover it", 9000, 9000],
    ["now holds exactly the amount", 9000, 1000],
    ["the date holds exactly the amount and now more", 1000, 9000],
  ])("allows a backdated transfer when %s", async (_label, onDate, now) => {
    heldOnAndNow(onDate, now);

    await expect(
      createTransfer(
        USER_ID,
        { ...INPUT, amount: 1000, date: "2026-10-02" },
        TODAY,
      ),
    ).resolves.toBeUndefined();
    expect(db.transfer.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a future date before opening any transaction", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-10-07" }, TODAY),
    ).rejects.toBeInstanceOf(TransferFutureDateError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("uses the Argentine calendar: at 22:00 in Buenos Aires, when UTC is already tomorrow, tomorrow is still the future", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T01:00:00.000Z"));

    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-10-07" }),
    ).rejects.toBeInstanceOf(TransferFutureDateError);
    await expect(
      createTransfer(USER_ID, { ...INPUT, date: "2026-10-06" }),
    ).resolves.toBeUndefined();
  });

  it("refuses the same account on both sides before locking anything", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_a" }, TODAY),
    ).rejects.toBeInstanceOf(TransferSameAccountError);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("treats an account that is not the user's as not found, on the side it is about", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_other" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "NOT_FOUND"));
    await expect(
      createTransfer(USER_ID, { ...INPUT, fromAccountId: "acc_other" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("from", "NOT_FOUND"));
  });

  it("refuses an account in another currency than the transfer, on its side", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_usd" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "CURRENCY_MISMATCH"));
  });

  it("refuses an archived account on either side of a new transfer", async () => {
    await expect(
      createTransfer(USER_ID, { ...INPUT, toAccountId: "acc_old" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("to", "ARCHIVED"));
    await expect(
      createTransfer(USER_ID, { ...INPUT, fromAccountId: "acc_old" }, TODAY),
    ).rejects.toEqual(new TransferAccountError("from", "ARCHIVED"));
    expect(db.transfer.create).not.toHaveBeenCalled();
  });
});

describe("updateTransfer", () => {
  // The transfer as stored: 50,00 from acc_a to acc_b on the first of the month.
  const CURRENT = {
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    amount: BigInt(5000),
    date: new Date("2026-10-01T00:00:00.000Z"),
  };
  const SAME = { ...INPUT, date: "2026-10-01" };

  beforeEach(() => {
    db.transfer.findFirst.mockResolvedValue(CURRENT);
  });

  it("is false for a transfer that is not the user's, touching nothing else", async () => {
    db.transfer.findFirst.mockResolvedValue(null);

    await expect(updateTransfer(USER_ID, "tr_x", INPUT, TODAY)).resolves.toBe(
      false,
    );
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
    expect(transferLocks.lockTransfers).toHaveBeenCalledWith(db, USER_ID, [
      "tr_x",
    ]);
    expect(db.transfer.findFirst).toHaveBeenCalledWith({
      where: { id: "tr_x", userId: USER_ID },
      select: {
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        date: true,
      },
    });
  });

  it("locks the transfer row, then reads it, then locks the accounts, then reads the balances, then writes (a concurrent edit or delete of the same transfer can never leave the funds checked against stale accounts)", async () => {
    const order: string[] = [];

    transferLocks.lockTransfers.mockImplementation(async () => {
      order.push("lock transfers");
    });
    db.transfer.findFirst.mockImplementation(async () => {
      order.push("read transfer");

      return CURRENT;
    });
    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [ACCOUNTS[id]];
      },
    );
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("funds");

      return [{ accountId: "acc_a", currency: "ARS", balance: 10000 }];
    });
    db.transfer.updateMany.mockImplementation(async () => {
      order.push("write");

      return { count: 1 };
    });

    await updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 6000 }, TODAY);

    expect(order).toEqual([
      "lock transfers",
      "read transfer",
      "lock acc_a",
      "lock acc_b",
      "funds",
      "funds",
      "write",
    ]);
    expect(transferLocks.lockTransfers).toHaveBeenCalledWith(db, USER_ID, [
      "tr_1",
    ]);
  });

  it("moves the destination AND lowers the amount: the old destination gives back the whole old amount, not the difference", async () => {
    // acc_a -> acc_b 50,00 becomes acc_a -> acc_c 40,00: acc_b must give back all 50,00.
    held({ acc_a: 10000, acc_b: 4999 });

    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, toAccountId: "acc_c", amount: 4000 },
        TODAY,
      ),
    ).rejects.toMatchObject({
      name: "TransferGiveBackError",
      available: 4999,
      amount: 5000,
    });
    expect(db.transfer.updateMany).not.toHaveBeenCalled();

    held({ acc_a: 10000, acc_b: 5000 });

    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, toAccountId: "acc_c", amount: 4000 },
        TODAY,
      ),
    ).resolves.toBe(true);
  });

  it("refuses an edit that moves the date earlier when the source holds less NOW, even if it held enough on the new date, and writes nothing", async () => {
    heldOnAndNow(5000, 0);

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, date: "2026-09-20" }, TODAY),
    ).rejects.toMatchObject({
      name: "TransferInsufficientFundsError",
      available: 0,
      currency: "ARS",
    });
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it("allows an edit that moves the date earlier when the source holds the amount both then and now (exactly, now)", async () => {
    heldOnAndNow(9000, 5000);

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, date: "2026-09-20" }, TODAY),
    ).resolves.toBe(true);
    expect(db.transfer.updateMany).toHaveBeenCalledTimes(1);
  });

  it("never reads a balance for an edit that changes nothing in the money (only the notes): it cannot fail for funds however much the accounts spent since", async () => {
    held({ acc_a: 0, acc_b: 0 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, notes: "Con nota" }, TODAY),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
  });

  it("leaves the edited transfer out of its own funds: an account that holds exactly that transfer's money can raise it by what it has", async () => {
    held({ acc_a: 7000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 7000 }, TODAY),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(2);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_a"],
      { asOf: "2026-10-01", excludeTransferId: "tr_1" },
    );
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_a"],
      { excludeTransferId: "tr_1" },
    );
  });

  it("checks the source again when the amount goes up beyond what it holds", async () => {
    held({ acc_a: 5500 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 6000 }, TODAY),
    ).rejects.toBeInstanceOf(TransferInsufficientFundsError);
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["another source", { fromAccountId: "acc_c", toAccountId: "acc_b" }],
    ["another day", { date: "2026-09-15" }],
  ])(
    "checks the new source, on the new date, for an edit with %s",
    async (_label, patch) => {
      held({ acc_a: 0, acc_c: 0 });

      await expect(
        updateTransfer(USER_ID, "tr_1", { ...SAME, ...patch }, TODAY),
      ).rejects.toBeInstanceOf(TransferInsufficientFundsError);
    },
  );

  it("refuses lowering the amount when the destination already spent the money it would give back", async () => {
    // 50,00 down to 40,00: acc_b must give back 10,00 and holds 8,00.
    held({ acc_b: 800 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 4000 }, TODAY),
    ).rejects.toMatchObject({
      name: "TransferGiveBackError",
      accountLabel: "Efectivo · Efectivo",
      available: 800,
      amount: 1000,
      currency: "ARS",
    });
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_b",
    ]);
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it("allows lowering the amount when the destination can give back exactly the difference, and never checks the source for it", async () => {
    held({ acc_b: 1000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, amount: 4000 }, TODAY),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(1);
  });

  it("refuses moving the transfer to another destination when the old destination already spent the money", async () => {
    held({ acc_b: 2000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, toAccountId: "acc_c" }, TODAY),
    ).rejects.toBeInstanceOf(TransferGiveBackError);
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_b", userId: USER_ID },
      select: { name: true, bank: { select: { name: true } } },
    });
    expect(db.transfer.updateMany).not.toHaveBeenCalled();
  });

  it("allows moving it to another destination when the old one still holds the whole amount", async () => {
    held({ acc_b: 5000 });

    await expect(
      updateTransfer(USER_ID, "tr_1", { ...SAME, toAccountId: "acc_c" }, TODAY),
    ).resolves.toBe(true);
  });

  it("compares net changes per account: a destination that becomes the new source is checked once, as the source, without the transfer's old inflow", async () => {
    // acc_b was the destination (+50,00) and becomes the source of 30,00 on the same day.
    held({ acc_b: 7000 });

    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, fromAccountId: "acc_b", toAccountId: "acc_a", amount: 3000 },
        TODAY,
      ),
    ).resolves.toBe(true);
    expect(balances.readAccountBalances).toHaveBeenCalledTimes(2);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_b"],
      { asOf: "2026-10-01", excludeTransferId: "tr_1" },
    );
    expect(balances.readAccountBalances).toHaveBeenCalledWith(
      db,
      USER_ID,
      ["acc_b"],
      { excludeTransferId: "tr_1" },
    );
  });

  it("locks the accounts of the old and the new transfer together, in ascending id order", async () => {
    held({ acc_b: 9000, acc_c: 9000 });

    await updateTransfer(
      USER_ID,
      "tr_1",
      { ...SAME, fromAccountId: "acc_c", toAccountId: "acc_a" },
      TODAY,
    );

    expect(db.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
      "acc_c",
    ]);
  });

  it("lets an edit keep an account that was archived since, on the side it was already", async () => {
    db.transfer.findFirst.mockResolvedValue({
      ...CURRENT,
      toAccountId: "acc_old",
    });

    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, toAccountId: "acc_old", notes: "x" },
        TODAY,
      ),
    ).resolves.toBe(true);
  });

  it("never moves a side to an archived account", async () => {
    await expect(
      updateTransfer(
        USER_ID,
        "tr_1",
        { ...SAME, toAccountId: "acc_old" },
        TODAY,
      ),
    ).rejects.toEqual(new TransferAccountError("to", "ARCHIVED"));
  });

  it("writes an explicit field list, scoped by the owner, and answers whether it changed anything", async () => {
    await updateTransfer(USER_ID, "tr_1", { ...SAME, notes: "Nota" }, TODAY);

    expect(db.transfer.updateMany).toHaveBeenCalledWith({
      where: { id: "tr_1", userId: USER_ID },
      data: {
        fromAccountId: "acc_a",
        toAccountId: "acc_b",
        amount: BigInt(5000),
        date: new Date("2026-10-01T00:00:00.000Z"),
        notes: "Nota",
      },
    });

    db.transfer.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateTransfer(USER_ID, "tr_1", SAME, TODAY)).resolves.toBe(
      false,
    );
  });

  it("refuses a future date before opening any transaction", async () => {
    await expect(
      updateTransfer(USER_ID, "tr_1", { ...INPUT, date: "2026-10-07" }, TODAY),
    ).rejects.toBeInstanceOf(TransferFutureDateError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("deleteTransfer and deleteTransfers", () => {
  const row = (
    id: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
  ) => ({ id, fromAccountId, toAccountId, amount: BigInt(amount) });

  it("reads the user's transfers, locks both accounts in ascending id order, checks the destination and deletes, in one transaction", async () => {
    const order: string[] = [];

    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_b", "acc_a", 5000),
    ]);
    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [ACCOUNTS[id]];
      },
    );
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("funds");

      return [{ accountId: "acc_a", currency: "ARS", balance: 5000 }];
    });
    db.transfer.deleteMany.mockImplementation(async () => {
      order.push("delete");

      return { count: 1 };
    });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);

    expect(order).toEqual(["lock acc_a", "lock acc_b", "funds", "delete"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.transfer.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_1"] }, userId: USER_ID },
      select: {
        id: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
      },
    });
    expect(db.transfer.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_1"] }, userId: USER_ID },
    });
  });

  it("refuses to delete a transfer whose destination already spent the money, naming the account and what it holds, and deletes nothing", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_b: 3000 });

    await expect(deleteTransfer(USER_ID, "tr_1")).rejects.toMatchObject({
      name: "TransferGiveBackError",
      accountLabel: "Efectivo · Efectivo",
      available: 3000,
      amount: 5000,
      currency: "ARS",
    });
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_b",
    ]);
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });

  it("allows deleting when the destination still holds exactly the amount", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_b: 5000 });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);
  });

  it("deletes a transfer whose source was archived since when the destination holds the amount (the source only gains), and refuses when it does not", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_old", "acc_b", 5000),
    ]);
    held({ acc_b: 5000 });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);
    expect(db.transfer.deleteMany).toHaveBeenCalledTimes(1);

    db.transfer.deleteMany.mockClear();
    held({ acc_b: 4999 });

    await expect(deleteTransfer(USER_ID, "tr_1")).rejects.toBeInstanceOf(
      TransferGiveBackError,
    );
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });

  it("never checks the source of the transfer: it only gains", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    held({ acc_a: -9999, acc_b: 9999 });

    await expect(deleteTransfer(USER_ID, "tr_1")).resolves.toBe(true);
    expect(balances.readAccountBalances.mock.calls[0][2]).toEqual(["acc_b"]);
  });

  it("is false for a transfer that is not the user's, locking and deleting nothing", async () => {
    db.transfer.findMany.mockResolvedValue([]);

    await expect(deleteTransfer(USER_ID, "tr_x")).resolves.toBe(false);
    expect(transferLocks.lockTransfers).toHaveBeenCalledWith(db, USER_ID, [
      "tr_x",
    ]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 0 for a bulk delete of ids that are all gone or foreign, writing nothing", async () => {
    db.transfer.findMany.mockResolvedValue([]);

    await expect(deleteTransfers(USER_ID, ["tr_x", "tr_y"])).resolves.toBe(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });

  it("locks the transfer rows, then reads them, then locks the accounts, then reads the balances, then deletes", async () => {
    const order: string[] = [];

    transferLocks.lockTransfers.mockImplementation(async () => {
      order.push("lock transfers");
    });
    db.transfer.findMany.mockImplementation(async () => {
      order.push("read transfers");

      return [row("tr_1", "acc_a", "acc_b", 5000)];
    });
    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [ACCOUNTS[id]];
      },
    );
    balances.readAccountBalances.mockImplementation(async () => {
      order.push("funds");

      return [{ accountId: "acc_b", currency: "ARS", balance: 5000 }];
    });
    db.transfer.deleteMany.mockImplementation(async () => {
      order.push("delete");

      return { count: 1 };
    });

    await deleteTransfer(USER_ID, "tr_1");

    expect(order).toEqual([
      "lock transfers",
      "read transfers",
      "lock acc_a",
      "lock acc_b",
      "funds",
      "delete",
    ]);
  });

  it("locks every selected transfer in one statement, in the order asked (the helper sorts them)", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 100),
      row("tr_2", "acc_a", "acc_b", 100),
    ]);
    db.transfer.deleteMany.mockResolvedValue({ count: 2 });

    await deleteTransfers(USER_ID, ["tr_2", "tr_1"]);

    expect(transferLocks.lockTransfers).toHaveBeenCalledTimes(1);
    expect(transferLocks.lockTransfers).toHaveBeenCalledWith(db, USER_ID, [
      "tr_2",
      "tr_1",
    ]);
  });

  it("deletes only the user's transfers among the ids and says how many went", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
      row("tr_2", "acc_a", "acc_b", 100),
    ]);
    db.transfer.deleteMany.mockResolvedValue({ count: 2 });

    await expect(
      deleteTransfers(USER_ID, ["tr_1", "tr_2", "tr_foreign"]),
    ).resolves.toBe(2);
    expect(db.transfer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["tr_1", "tr_2", "tr_foreign"] }, userId: USER_ID },
      }),
    );
    expect(db.transfer.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_1", "tr_2"] }, userId: USER_ID },
    });
  });

  it("checks a bulk delete by the net change of each account over the whole selection, whatever the order of the ids", async () => {
    // acc_a -> acc_b 50,00 and acc_b -> acc_c 20,00: acc_b gives back 50,00 and gets 20,00 back (net 30,00),
    // acc_c gives back 20,00, acc_a only gains.
    db.transfer.findMany.mockResolvedValue([
      row("tr_2", "acc_b", "acc_c", 2000),
      row("tr_1", "acc_a", "acc_b", 5000),
    ]);
    db.transfer.deleteMany.mockResolvedValue({ count: 2 });
    held({ acc_b: 3000, acc_c: 2000 });

    await expect(deleteTransfers(USER_ID, ["tr_2", "tr_1"])).resolves.toBe(2);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_b",
      "acc_c",
    ]);
    expect(db.transfer.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tr_2", "tr_1"] }, userId: USER_ID },
    });
  });

  it("refuses the whole bulk delete when one account cannot give back its net amount, deleting nothing", async () => {
    db.transfer.findMany.mockResolvedValue([
      row("tr_1", "acc_a", "acc_b", 5000),
      row("tr_2", "acc_b", "acc_c", 2000),
    ]);
    held({ acc_b: 3000, acc_c: 1999 });

    await expect(
      deleteTransfers(USER_ID, ["tr_1", "tr_2"]),
    ).rejects.toMatchObject({
      name: "TransferGiveBackError",
      available: 1999,
      amount: 2000,
    });
    expect(db.transfer.deleteMany).not.toHaveBeenCalled();
  });
});

describe("listTransfers", () => {
  const row = (patch: Record<string, unknown> = {}) => ({
    id: "tr_1",
    userId: USER_ID,
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    amount: BigInt(150050),
    date: new Date("2026-10-03T00:00:00.000Z"),
    notes: "Alquiler",
    createdAt: OLD,
    updatedAt: OLD,
    fromAccount: {
      name: "Caja de ahorro",
      currency: "ARS",
      bank: { name: "Galicia" },
    },
    toAccount: { name: "Efectivo", bank: { name: "Efectivo" } },
    ...patch,
  });

  it("reads the user's transfers of the month, newest first, with the accounts labelled", async () => {
    db.transfer.findMany.mockResolvedValue([row()]);

    const transfers = await listTransfers(USER_ID, "2026-10");

    expect(db.transfer.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        date: {
          gte: new Date("2026-10-01T00:00:00.000Z"),
          lte: new Date("2026-10-31T00:00:00.000Z"),
        },
      },
      include: {
        fromAccount: {
          select: {
            name: true,
            currency: true,
            bank: { select: { name: true } },
          },
        },
        toAccount: { select: { name: true, bank: { select: { name: true } } } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 500,
    });
    expect(transfers).toEqual([
      {
        id: "tr_1",
        fromAccountId: "acc_a",
        toAccountId: "acc_b",
        fromLabel: "Galicia · Caja de ahorro",
        toLabel: "Efectivo · Efectivo",
        currency: "ARS",
        amount: 150050,
        date: "2026-10-03",
        notes: "Alquiler",
      },
    ]);
  });
});
