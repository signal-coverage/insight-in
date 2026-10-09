import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  account: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  income: { count: vi.fn() },
  expense: { count: vi.fn() },
  recurringIncome: { count: vi.fn() },
  recurringExpense: { count: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));
const movements = vi.hoisted(() => ({ countAccountMovements: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/balances/accountBalances", () => balances);
vi.mock("./movements", () => movements);

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  AccountCurrencyLockedError,
  AccountHasBalanceError,
  AccountHasMovementsError,
  AccountNotFoundError,
  CryptoCurrencyNotAllowedError,
  DuplicateAccountError,
} from "./errors";
import {
  archiveAccount,
  createAccount,
  deleteAccount,
  unarchiveAccount,
  updateAccount,
} from "./service";

const { account } = db;

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const accountRow = (patch: Record<string, unknown> = {}) => ({
  id: "acc_1",
  userId: USER_ID,
  bankId: "bank_1",
  name: "Caja de ahorro",
  currency: "ARS",
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
});

describe("createAccount", () => {
  const input = { bankId: "bank_1", name: "Caja de ahorro", currency: "ARS" };

  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.findFirst.mockResolvedValue(null);
    account.create.mockResolvedValue(accountRow());
  });

  it("locks the user's bank, looks for a clash inside it ignoring case, then creates, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async () => {
      order.push("lock");

      return [{ id: "bank_1", archivedAt: null }];
    });
    account.findFirst.mockImplementation(async () => {
      order.push("clash");

      return null;
    });
    account.create.mockImplementation(async () => {
      order.push("create");

      return accountRow();
    });

    const created = await createAccount(USER_ID, input);

    expect(order).toEqual(["lock", "clash", "create"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(account.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        bankId: "bank_1",
        name: { equals: "Caja de ahorro", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(account.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        bankId: "bank_1",
        name: "Caja de ahorro",
        currency: "ARS",
      },
    });
    expect(created).toEqual({
      id: "acc_1",
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
      archived: false,
    });
  });

  it("allows the same name in another bank: the clash lookup is scoped to the chosen bank", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_2", archivedAt: null }]);
    account.create.mockResolvedValue(
      accountRow({ id: "acc_9", bankId: "bank_2" }),
    );

    await createAccount(USER_ID, {
      ...input,
      bankId: "bank_2",
      name: "Efectivo",
    });

    expect(account.findFirst.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      bankId: "bank_2",
      name: { equals: "Efectivo", mode: "insensitive" },
    });
    expect(account.create).toHaveBeenCalledTimes(1);
  });

  it("treats another user's bank (or an unknown id) as not found and creates nothing", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      createAccount(USER_ID, { ...input, bankId: "bank_of_someone_else" }),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(account.create).not.toHaveBeenCalled();
  });

  it("refuses an archived bank: a bank archived a moment earlier is seen, the lock serializes both", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

    await expect(createAccount(USER_ID, input)).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(account.create).not.toHaveBeenCalled();
  });

  it("refuses a name the bank already has with another casing", async () => {
    account.findFirst.mockResolvedValue({ id: "acc_9" });

    await expect(
      createAccount(USER_ID, { ...input, name: "CAJA DE AHORRO" }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
    expect(account.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint (two identical requests at once) to the same error", async () => {
    account.create.mockRejectedValue(uniqueViolation());

    await expect(createAccount(USER_ID, input)).rejects.toBeInstanceOf(
      DuplicateAccountError,
    );
  });

  it("lets any other failure through", async () => {
    account.create.mockRejectedValue(new Error("db down"));

    await expect(createAccount(USER_ID, input)).rejects.toThrow("db down");
  });

  it("refuses a crypto currency in an entity bank, creating nothing", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "bank_1", archivedAt: null, kind: "ENTITY" },
    ]);

    const error = await createAccount(USER_ID, {
      ...input,
      currency: "USDC",
    }).catch((thrown) => thrown);

    expect(error).toBeInstanceOf(CryptoCurrencyNotAllowedError);
    expect(error.currency).toBe("USDC");
    expect(account.create).not.toHaveBeenCalled();
  });

  it("creates a crypto account in a virtual wallet, reading the kind from the bank lock", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "bank_1", archivedAt: null, kind: "WALLET" },
    ]);
    account.create.mockResolvedValue(accountRow({ currency: "USDC" }));

    await createAccount(USER_ID, { ...input, currency: "USDC" });

    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(account.create.mock.calls[0][0].data.currency).toBe("USDC");
  });

  it("lets a virtual wallet hold legal tender too", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "bank_1", archivedAt: null, kind: "WALLET" },
    ]);

    await createAccount(USER_ID, input);

    expect(account.create.mock.calls[0][0].data.currency).toBe("ARS");
  });

  it("writes an explicit field list: the owner and the archive date never come from the payload", async () => {
    await createAccount(USER_ID, {
      ...input,
      userId: "attacker",
      archivedAt: new Date(),
    } as never);

    expect(account.create.mock.calls[0][0].data).toEqual({
      userId: USER_ID,
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
    });
  });
});

describe("updateAccount", () => {
  const BANK_ROW = { id: "bank_1", archivedAt: null, kind: "ENTITY" };
  const ACCOUNT_ROW = { id: "acc_1", currency: "ARS", archivedAt: null };

  // The bank lock reads "Bank", the account lock reads "Account".
  const lockRows = (bankRows: unknown[], accountRows: unknown[]) =>
    db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) =>
      strings.join("?").includes('FROM "Bank"') ? bankRows : accountRows,
    );

  beforeEach(() => {
    lockRows([BANK_ROW], [ACCOUNT_ROW]);
    account.findFirst.mockResolvedValue({ id: "acc_1", bankId: "bank_1" });
    movements.countAccountMovements.mockResolvedValue(0);
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the account's bank and then the account, checks the rest of its bank and writes the name and the currency, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      const isBank = strings.join("?").includes('FROM "Bank"');

      order.push(isBank ? "lock bank" : "lock account");

      return isBank ? [BANK_ROW] : [ACCOUNT_ROW];
    });
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await updateAccount(USER_ID, "acc_1", { name: "Ahorros", currency: "USD" });

    expect(order).toEqual(["lock bank", "lock account"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(account.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "acc_1", userId: USER_ID },
      select: { id: true, bankId: true },
    });
    expect(account.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        userId: USER_ID,
        bankId: "bank_1",
        id: { not: "acc_1" },
        name: { equals: "Ahorros", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Ahorros", currency: "USD" },
    });
  });

  it("lets an account take another casing of its own name: the clash lookup leaves the account itself out", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", {
        name: "caja de ahorro",
        currency: "ARS",
      }),
    ).resolves.toBeUndefined();
    expect(account.findFirst.mock.calls[1][0].where.id).toEqual({
      not: "acc_1",
    });
  });

  it("refuses to change the currency of an account with movements, writing nothing", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    movements.countAccountMovements.mockResolvedValue(4);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USD" }),
    ).rejects.toBeInstanceOf(AccountCurrencyLockedError);
    expect(movements.countAccountMovements).toHaveBeenCalledWith(
      db,
      USER_ID,
      "acc_1",
    );
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("lets an account with movements be renamed when the currency stays, without counting them", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    movements.countAccountMovements.mockResolvedValue(4);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "ARS" }),
    ).resolves.toBeUndefined();
    expect(movements.countAccountMovements).not.toHaveBeenCalled();
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Caja", currency: "ARS" },
    });
  });

  it("lets an account without movements change its currency", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USD" }),
    ).resolves.toBeUndefined();
    expect(movements.countAccountMovements).toHaveBeenCalledTimes(1);
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "Caja", currency: "USD" },
    });
  });

  it("refuses a crypto currency for an account of an entity bank, writing nothing", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "Caja", currency: "USDC" }),
    ).rejects.toBeInstanceOf(CryptoCurrencyNotAllowedError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("lets an account of a virtual wallet take a crypto currency", async () => {
    lockRows([{ ...BANK_ROW, kind: "WALLET" }], [ACCOUNT_ROW]);
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "USDC", currency: "USDC" }),
    ).resolves.toBeUndefined();
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { name: "USDC", currency: "USDC" },
    });
  });

  it("treats another user's account (or an unknown id) as not found and writes nothing", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      updateAccount(USER_ID, "acc_of_someone_else", {
        name: "A",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("is not found when the bank is locked but the account lock returns nothing, writing nothing", async () => {
    lockRows([BANK_ROW], []);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "A", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.findFirst).not.toHaveBeenCalled();
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("is not found when the locked account has no row for the user", async () => {
    account.findFirst.mockResolvedValue(null);

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "A", currency: "ARS" }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the name of another account of the same bank", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce({ id: "acc_2" });

    await expect(
      updateAccount(USER_ID, "acc_1", {
        name: "Cuenta en dólares",
        currency: "ARS",
      }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("maps the unique constraint to the same error", async () => {
    account.findFirst
      .mockResolvedValueOnce({ id: "acc_1", bankId: "bank_1" })
      .mockResolvedValueOnce(null);
    account.updateMany.mockRejectedValue(uniqueViolation());

    await expect(
      updateAccount(USER_ID, "acc_1", { name: "A", currency: "ARS" }),
    ).rejects.toBeInstanceOf(DuplicateAccountError);
  });
});

describe("archiveAccount", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: null },
    ]);
    balances.readAccountBalances.mockResolvedValue([]);
    db.income.count.mockResolvedValue(0);
    db.expense.count.mockResolvedValue(0);
    db.recurringIncome.count.mockResolvedValue(0);
    db.recurringExpense.count.mockResolvedValue(0);
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("archives an account at zero with nothing pending, under the account's lock, in one transaction", async () => {
    await expect(archiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID, [
      "acc_1",
    ]);
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it("refuses while the account holds money, saying how much and in its currency", async () => {
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "acc_1", currency: "ARS", balance: 150000 },
    ]);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toMatchObject({
      name: "AccountHasBalanceError",
      balance: 150000,
      currency: "ARS",
    });
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a negative balance too: zero means zero", async () => {
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "acc_1", currency: "ARS", balance: -1 },
    ]);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      AccountHasBalanceError,
    );
  });

  it("refuses while planned incomes or expenses and recurring templates still use it, saying how many", async () => {
    db.income.count.mockResolvedValue(1);
    db.expense.count.mockResolvedValue(2);
    db.recurringIncome.count.mockResolvedValue(1);
    db.recurringExpense.count.mockResolvedValue(0);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toMatchObject({
      name: "AccountInUseError",
      pending: 3,
      templates: 1,
    });
    expect(db.income.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1", status: "PLANNED" },
    });
    expect(db.expense.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1", status: "PLANNED" },
    });
    expect(db.recurringIncome.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1" },
    });
    expect(db.recurringExpense.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, accountId: "acc_1" },
    });
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("refuses when only a recurring expense template points at it", async () => {
    db.recurringExpense.count.mockResolvedValue(2);

    await expect(archiveAccount(USER_ID, "acc_1")).rejects.toMatchObject({
      name: "AccountInUseError",
      pending: 0,
      templates: 2,
    });
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("does not count covered entries: they never move money", async () => {
    await archiveAccount(USER_ID, "acc_1");

    expect(db.expense.count.mock.calls[0][0].where.status).toBe("PLANNED");
    expect(db.income.count.mock.calls[0][0].where.status).toBe("PLANNED");
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      archiveAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for an account that is already archived", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: AT },
    ]);

    await expect(archiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
    expect(balances.readAccountBalances).not.toHaveBeenCalled();
    expect(account.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteAccount", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: null },
    ]);
    movements.countAccountMovements.mockResolvedValue(0);
    account.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes an account with no movement at all, under the account's lock, in one transaction", async () => {
    await expect(deleteAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(movements.countAccountMovements).toHaveBeenCalledWith(
      db,
      USER_ID,
      "acc_1",
    );
    expect(account.deleteMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
    });
  });

  it("deletes an archived account that has no movement too", async () => {
    db.$queryRaw.mockResolvedValue([
      { id: "acc_1", currency: "ARS", archivedAt: AT },
    ]);

    await expect(deleteAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
    expect(account.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("refuses an account with any movement or opening amount, deleting nothing", async () => {
    movements.countAccountMovements.mockResolvedValue(3);

    await expect(deleteAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      AccountHasMovementsError,
    );
    expect(account.deleteMany).not.toHaveBeenCalled();
  });

  it("treats another user's account (or an unknown id) as not found, without counting or deleting", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      deleteAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(movements.countAccountMovements).not.toHaveBeenCalled();
    expect(account.deleteMany).not.toHaveBeenCalled();
  });

  it("reports not found when the row vanished before the delete ran", async () => {
    account.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
  });

  it("maps the foreign-key refusal of a movement saved in the same instant to the same error", async () => {
    account.deleteMany.mockRejectedValue(
      Object.assign(new Error("fk"), { code: "P2003" }),
    );

    await expect(deleteAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      AccountHasMovementsError,
    );
  });

  it("lets an unexpected database error through untouched", async () => {
    const boom = new Error("connection lost");

    account.deleteMany.mockRejectedValue(boom);

    await expect(deleteAccount(USER_ID, "acc_1")).rejects.toBe(boom);
  });
});

describe("unarchiveAccount", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.findFirst.mockResolvedValue({ archivedAt: AT });
    account.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the account's bank first, then brings the account back, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async () => {
      order.push("lock");

      return [{ id: "bank_1", archivedAt: null }];
    });
    account.findFirst.mockImplementation(async () => {
      order.push("read");

      return { archivedAt: AT };
    });
    account.updateMany.mockImplementation(async () => {
      order.push("reactivate");

      return { count: 1 };
    });

    await expect(unarchiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();

    expect(order).toEqual(["lock", "read", "reactivate"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { archivedAt: true },
    });
    expect(account.updateMany).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      data: { archivedAt: null },
    });
  });

  it("refuses to bring an account back under an archived bank", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

    await expect(unarchiveAccount(USER_ID, "acc_1")).rejects.toBeInstanceOf(
      BankArchivedError,
    );
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("treats another user's account (or an unknown id) as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      unarchiveAccount(USER_ID, "acc_of_someone_else"),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(account.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for an account that is already active, even under an archived bank", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);
    account.findFirst.mockResolvedValue({ archivedAt: null });

    await expect(unarchiveAccount(USER_ID, "acc_1")).resolves.toBeUndefined();
    expect(account.updateMany).not.toHaveBeenCalled();
  });
});
