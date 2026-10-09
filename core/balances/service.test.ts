import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  openingBalance: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  account: { findMany: vi.fn() },
}));
const defaultCash = vi.hoisted(() => ({ ensureDefaultCash: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/defaultCash", () => defaultCash);

import {
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";

import {
  getOpeningBalanceEditorData,
  getOpeningBalances,
  saveOpeningBalances,
} from "./service";

const { openingBalance, account } = db;

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

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

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  db.$queryRaw.mockResolvedValue([]);
  openingBalance.findMany.mockResolvedValue([]);
  openingBalance.upsert.mockResolvedValue({});
  openingBalance.deleteMany.mockResolvedValue({ count: 0 });
  account.findMany.mockResolvedValue([]);
});

describe("getOpeningBalances", () => {
  it("reads only the user's own rows, with the currency of each account", async () => {
    await getOpeningBalances(USER_ID);

    expect(openingBalance.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { account: { select: { currency: true } } },
    });
  });

  it("is null when the user never set one", async () => {
    await expect(getOpeningBalances(USER_ID)).resolves.toBeNull();
  });

  it("gives the shared month and one amount per account, as plain numbers", async () => {
    openingBalance.findMany.mockResolvedValue([
      openingRow("acc_bank", "ARS", 5000050),
      openingRow("acc_usd", "USD", 12000),
    ]);

    await expect(getOpeningBalances(USER_ID)).resolves.toEqual({
      month: "2026-06",
      amounts: [
        { accountId: "acc_bank", currency: "ARS", amount: 5000050 },
        { accountId: "acc_usd", currency: "USD", amount: 12000 },
      ],
    });
  });

  it("reads through the client it is given (a transaction, for the archive rule)", async () => {
    const tx = { openingBalance: { findMany: vi.fn().mockResolvedValue([]) } };

    await getOpeningBalances(USER_ID, tx as never);

    expect(tx.openingBalance.findMany).toHaveBeenCalledTimes(1);
    expect(openingBalance.findMany).not.toHaveBeenCalled();
  });
});

describe("saveOpeningBalances", () => {
  const input = {
    month: "2026-06",
    amounts: [
      { accountId: "acc_bank", currency: "ARS", amount: 5000 },
      { accountId: "acc_cash", currency: "ARS", amount: 0 },
    ],
  };

  beforeEach(() => {
    account.findMany.mockResolvedValue([
      { id: "acc_bank", currency: "ARS" },
      { id: "acc_cash", currency: "ARS" },
    ]);
  });

  it("checks the accounts among the user's own before writing", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, id: { in: ["acc_bank", "acc_cash"] } },
      select: { id: true, currency: true },
    });
  });

  it("upserts one row per account, all with the same month", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.upsert).toHaveBeenCalledTimes(2);
    expect(openingBalance.upsert).toHaveBeenCalledWith({
      where: { userId_accountId: { userId: USER_ID, accountId: "acc_bank" } },
      create: {
        userId: USER_ID,
        accountId: "acc_bank",
        amount: BigInt(5000),
        month: "2026-06",
      },
      update: { amount: BigInt(5000), month: "2026-06" },
    });
  });

  it("keeps an explicit zero as an amount: it is upserted as 0, not skipped", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.upsert.mock.calls[1][0]).toEqual({
      where: { userId_accountId: { userId: USER_ID, accountId: "acc_cash" } },
      create: {
        userId: USER_ID,
        accountId: "acc_cash",
        amount: BigInt(0),
        month: "2026-06",
      },
      update: { amount: BigInt(0), month: "2026-06" },
    });
  });

  it("removes the user's other rows, so what was cleared stops counting", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        NOT: { accountId: { in: ["acc_bank", "acc_cash"] } },
      },
    });
  });

  it("removes every row of the user when there is no amount left, without reading accounts", async () => {
    await saveOpeningBalances(USER_ID, { month: "2026-06", amounts: [] });

    expect(account.findMany).not.toHaveBeenCalled();
    expect(openingBalance.upsert).not.toHaveBeenCalled();
    expect(openingBalance.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("refuses an account that is not the user's (or is gone), writing nothing", async () => {
    account.findMany.mockResolvedValue([{ id: "acc_bank", currency: "ARS" }]);

    await expect(saveOpeningBalances(USER_ID, input)).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    expect(openingBalance.deleteMany).not.toHaveBeenCalled();
    expect(openingBalance.upsert).not.toHaveBeenCalled();
  });

  it("refuses an amount in another currency than its account, writing nothing", async () => {
    account.findMany.mockResolvedValue([
      { id: "acc_bank", currency: "USD" },
      { id: "acc_cash", currency: "ARS" },
    ]);

    await expect(saveOpeningBalances(USER_ID, input)).rejects.toBeInstanceOf(
      AccountCurrencyMismatchError,
    );
    expect(openingBalance.deleteMany).not.toHaveBeenCalled();
    expect(openingBalance.upsert).not.toHaveBeenCalled();
  });

  it("does it all in one transaction", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("takes a shared lock on the payload's accounts, in ascending id order, before it reads them", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(
      async (_strings: TemplateStringsArray, id: string) => {
        order.push(`lock ${id}`);

        return [];
      },
    );
    account.findMany.mockImplementation(async () => {
      order.push("read accounts");

      return [
        { id: "acc_a", currency: "ARS" },
        { id: "acc_b", currency: "ARS" },
      ];
    });

    await saveOpeningBalances(USER_ID, {
      month: "2026-06",
      amounts: [
        { accountId: "acc_b", currency: "ARS", amount: 1 },
        { accountId: "acc_a", currency: "ARS", amount: 2 },
      ],
    });

    expect(order).toEqual(["lock acc_a", "lock acc_b", "read accounts"]);
  });

  it("locks nothing when it only clears the opening balance", async () => {
    await saveOpeningBalances(USER_ID, { month: "2026-06", amounts: [] });

    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("getOpeningBalanceEditorData", () => {
  it("seeds the default cash account first, so there is always a row to fill", async () => {
    await getOpeningBalanceEditorData(USER_ID);

    expect(defaultCash.ensureDefaultCash).toHaveBeenCalledWith(USER_ID);
  });

  it("seeds the default cash account BEFORE it reads the accounts", async () => {
    const order: string[] = [];

    defaultCash.ensureDefaultCash.mockImplementation(async () => {
      order.push("seed");
    });
    account.findMany.mockImplementation(async () => {
      order.push("read");

      return [];
    });

    await getOpeningBalanceEditorData(USER_ID);

    expect(order).toEqual(["seed", "read"]);
  });

  it("offers the user's active accounts and the archived ones that already have an amount, grouped by bank", async () => {
    await getOpeningBalanceEditorData(USER_ID);

    expect(account.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        OR: [{ archivedAt: null }, { openingBalances: { some: {} } }],
      },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { bank: { id: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
  });

  it("names each account with its bank and says whether it is archived", async () => {
    account.findMany.mockResolvedValue([
      {
        id: "acc_bank",
        bankId: "bank_galicia",
        name: "Caja de ahorro",
        currency: "ARS",
        archivedAt: null,
        bank: { name: "Banco Galicia" },
      },
      {
        id: "acc_old",
        bankId: "bank_galicia",
        name: "Vieja",
        currency: "USD",
        archivedAt: AT,
        bank: { name: "Banco Galicia" },
      },
    ]);
    openingBalance.findMany.mockResolvedValue([
      openingRow("acc_old", "USD", 100),
    ]);

    await expect(getOpeningBalanceEditorData(USER_ID)).resolves.toEqual({
      opening: {
        month: "2026-06",
        amounts: [{ accountId: "acc_old", currency: "USD", amount: 100 }],
      },
      accounts: [
        {
          accountId: "acc_bank",
          bankId: "bank_galicia",
          bankName: "Banco Galicia",
          accountName: "Caja de ahorro",
          currency: "ARS",
          archived: false,
        },
        {
          accountId: "acc_old",
          bankId: "bank_galicia",
          bankName: "Banco Galicia",
          accountName: "Vieja",
          currency: "USD",
          archived: true,
        },
      ],
    });
  });
});
