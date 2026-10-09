import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bank: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  account: { count: vi.fn() },
  card: { count: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  BankHasAccountsError,
  BankHasCardsError,
  BankHasCryptoAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import {
  archiveBank,
  createBank,
  deleteBank,
  listBanksWithAccounts,
  unarchiveBank,
  updateBank,
} from "./service";

const { bank, account } = db;

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const bankRow = (patch: Record<string, unknown> = {}) => ({
  id: "bank_1",
  userId: USER_ID,
  name: "Banco Galicia",
  kind: "ENTITY",
  archivedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

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

describe("listBanksWithAccounts", () => {
  it("reads only the user's banks and accounts, in the order they were added", async () => {
    bank.findMany.mockResolvedValue([]);

    await listBanksWithAccounts(USER_ID);

    expect(bank.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        accounts: {
          where: { userId: USER_ID },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
  });

  it("returns plain banks and accounts: no owner, the archive date as a flag", async () => {
    bank.findMany.mockResolvedValue([
      {
        ...bankRow(),
        accounts: [
          accountRow(),
          accountRow({ id: "acc_2", name: "Vieja", archivedAt: AT }),
        ],
      },
      {
        ...bankRow({ id: "bank_2", name: "Viejo", archivedAt: AT }),
        accounts: [],
      },
    ]);

    expect(await listBanksWithAccounts(USER_ID)).toEqual([
      {
        id: "bank_1",
        name: "Banco Galicia",
        kind: "ENTITY",
        archived: false,
        accounts: [
          {
            id: "acc_1",
            bankId: "bank_1",
            name: "Caja de ahorro",
            currency: "ARS",
            archived: false,
          },
          {
            id: "acc_2",
            bankId: "bank_1",
            name: "Vieja",
            currency: "ARS",
            archived: true,
          },
        ],
      },
      {
        id: "bank_2",
        name: "Viejo",
        kind: "ENTITY",
        archived: true,
        accounts: [],
      },
    ]);
  });

  it("returns the kind of each bank", async () => {
    bank.findMany.mockResolvedValue([
      {
        ...bankRow({ id: "bank_mp", name: "Mercado Pago", kind: "WALLET" }),
        accounts: [],
      },
      { ...bankRow(), accounts: [] },
    ]);

    expect(
      (await listBanksWithAccounts(USER_ID)).map(({ kind }) => kind),
    ).toEqual(["WALLET", "ENTITY"]);
  });
});

describe("createBank", () => {
  it("looks for a clash among the user's banks ignoring case, then creates with an explicit field list", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockResolvedValue(bankRow());

    const created = await createBank(USER_ID, {
      name: "Banco Galicia",
      kind: "ENTITY",
    });

    expect(bank.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        name: { equals: "Banco Galicia", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(bank.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, name: "Banco Galicia", kind: "ENTITY" },
    });
    expect(created).toEqual({
      id: "bank_1",
      name: "Banco Galicia",
      kind: "ENTITY",
      archived: false,
    });
  });

  it("creates a virtual wallet when asked", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockResolvedValue(
      bankRow({ name: "Mercado Pago", kind: "WALLET" }),
    );

    const created = await createBank(USER_ID, {
      name: "Mercado Pago",
      kind: "WALLET",
    });

    expect(bank.create.mock.calls[0][0].data.kind).toBe("WALLET");
    expect(created.kind).toBe("WALLET");
  });

  it("refuses a name that exists with another casing", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_9" });

    await expect(
      createBank(USER_ID, { name: "BANCO GALICIA", kind: "ENTITY" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
    expect(bank.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint (two identical requests at once) to the same error", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockRejectedValue(uniqueViolation());

    await expect(
      createBank(USER_ID, { name: "Galicia", kind: "ENTITY" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
  });

  it("lets any other failure through", async () => {
    bank.findFirst.mockResolvedValue(null);
    bank.create.mockRejectedValue(new Error("db down"));

    await expect(
      createBank(USER_ID, { name: "Galicia", kind: "ENTITY" }),
    ).rejects.toThrow("db down");
  });
});

describe("updateBank", () => {
  const ENTITY_ROW = { id: "bank_1", archivedAt: null, kind: "ENTITY" };
  const WALLET_ROW = { id: "bank_1", archivedAt: null, kind: "WALLET" };
  const input = { name: "Galicia", kind: "ENTITY" as const };

  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([ENTITY_ROW]);
    bank.findFirst.mockResolvedValue(null);
    account.count.mockResolvedValue(0);
    bank.updateMany.mockResolvedValue({ count: 1 });
  });

  it("locks the bank, checks nobody else has the name and that an entity keeps no crypto account, then writes the name and the kind, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async () => {
      order.push("lock");

      return [ENTITY_ROW];
    });
    bank.findFirst.mockImplementation(async () => {
      order.push("clash");

      return null;
    });
    account.count.mockImplementation(async () => {
      order.push("crypto");

      return 0;
    });
    bank.updateMany.mockImplementation(async () => {
      order.push("write");

      return { count: 1 };
    });

    await updateBank(USER_ID, "bank_1", input);

    expect(order).toEqual(["lock", "clash", "crypto", "write"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        id: { not: "bank_1" },
        name: { equals: "Galicia", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      data: { name: "Galicia", kind: "ENTITY" },
    });
  });

  it("lets a bank take another casing of its own name: the clash lookup leaves the bank itself out", async () => {
    await expect(
      updateBank(USER_ID, "bank_1", { ...input, name: "banco galicia" }),
    ).resolves.toBeUndefined();
    expect(bank.findFirst.mock.calls[0][0].where.id).toEqual({
      not: "bank_1",
    });
  });

  it("treats another user's bank (or an unknown id) as not found and writes nothing", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      updateBank(USER_ID, "bank_of_someone_else", input),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(db.$queryRaw.mock.calls[0].slice(1)).toEqual([
      "bank_of_someone_else",
      USER_ID,
    ]);
    expect(bank.findFirst).not.toHaveBeenCalled();
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the name of another bank of the user", async () => {
    bank.findFirst.mockResolvedValue({ id: "bank_2" });

    await expect(
      updateBank(USER_ID, "bank_1", { ...input, name: "Mercado Pago" }),
    ).rejects.toBeInstanceOf(DuplicateBankError);
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("maps the unique constraint to the same error", async () => {
    bank.updateMany.mockRejectedValue(uniqueViolation());

    await expect(updateBank(USER_ID, "bank_1", input)).rejects.toBeInstanceOf(
      DuplicateBankError,
    );
  });

  it("is not found when the bank disappears before the write", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateBank(USER_ID, "bank_1", input)).rejects.toBeInstanceOf(
      BankNotFoundError,
    );
  });

  it("always lets an entity become a wallet, without counting anything", async () => {
    await expect(
      updateBank(USER_ID, "bank_1", { ...input, kind: "WALLET" }),
    ).resolves.toBeUndefined();
    expect(account.count).not.toHaveBeenCalled();
    expect(bank.updateMany.mock.calls[0][0].data).toEqual({
      name: "Galicia",
      kind: "WALLET",
    });
  });

  it("refuses to make a wallet an entity while it has crypto accounts, archived ones included, saying how many, and writes nothing", async () => {
    db.$queryRaw.mockResolvedValue([WALLET_ROW]);
    account.count.mockResolvedValue(2);

    const error = await updateBank(USER_ID, "bank_1", input).catch(
      (thrown) => thrown,
    );

    expect(error).toBeInstanceOf(BankHasCryptoAccountsError);
    expect(error.count).toBe(2);
    expect(account.count).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        bankId: "bank_1",
        currency: {
          in: [
            "USDC",
            "USDT",
            "DAI",
            "BTC",
            "ETH",
            "XMR",
            "SOL",
            "BNB",
            "LTC",
            "TRX",
          ],
        },
      },
    });
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("makes a wallet an entity once it has no crypto account left", async () => {
    db.$queryRaw.mockResolvedValue([WALLET_ROW]);

    await expect(updateBank(USER_ID, "bank_1", input)).resolves.toBeUndefined();
    expect(bank.updateMany.mock.calls[0][0].data.kind).toBe("ENTITY");
  });
});

describe("archiveBank", () => {
  it("locks the bank row first, then counts its active accounts and archives, in one transaction", async () => {
    const order: string[] = [];

    db.$queryRaw.mockImplementation(async () => {
      order.push("lock");

      return [{ id: "bank_1", archivedAt: null }];
    });
    account.count.mockImplementation(async () => {
      order.push("count");

      return 0;
    });
    bank.updateMany.mockImplementation(async () => {
      order.push("archive");

      return { count: 1 };
    });

    await expect(archiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();

    expect(order).toEqual(["lock", "count", "archive"]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(account.count).toHaveBeenCalledWith({
      where: { bankId: "bank_1", userId: USER_ID, archivedAt: null },
    });
    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it("refuses a bank that still has active accounts, says how many, and archives nothing", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.count.mockResolvedValue(2);

    await expect(archiveBank(USER_ID, "bank_1")).rejects.toMatchObject({
      name: "BankHasActiveAccountsError",
      count: 2,
    });
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("treats another user's bank (or an unknown id) as not found", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      archiveBank(USER_ID, "bank_of_someone_else"),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(account.count).not.toHaveBeenCalled();
    expect(bank.updateMany).not.toHaveBeenCalled();
  });

  it("does nothing, without failing, for a bank that is already archived", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

    await expect(archiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();
    expect(bank.updateMany).not.toHaveBeenCalled();
  });
});

describe("deleteBank", () => {
  beforeEach(() => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: null }]);
    account.count.mockResolvedValue(0);
    db.card.count.mockResolvedValue(0);
    bank.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes a bank with no accounts and no cards, under the bank's lock, in one transaction", async () => {
    await expect(deleteBank(USER_ID, "bank_1")).resolves.toBeUndefined();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(bank.deleteMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID },
    });
  });

  it("deletes an archived bank that has nothing left too", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "bank_1", archivedAt: AT }]);

    await expect(deleteBank(USER_ID, "bank_1")).resolves.toBeUndefined();
    expect(bank.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("counts every account of the user in that bank, archived ones included", async () => {
    await deleteBank(USER_ID, "bank_1");

    expect(account.count).toHaveBeenCalledWith({
      where: { bankId: "bank_1", userId: USER_ID },
    });
    expect(db.card.count).toHaveBeenCalledWith({
      where: { bankId: "bank_1", userId: USER_ID },
    });
  });

  it("refuses while the bank still has accounts, saying how many", async () => {
    account.count.mockResolvedValue(2);

    await expect(deleteBank(USER_ID, "bank_1")).rejects.toMatchObject({
      name: "BankHasAccountsError",
      count: 2,
    });
    expect(bank.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses while the bank still has cards, saying how many", async () => {
    db.card.count.mockResolvedValue(1);

    await expect(deleteBank(USER_ID, "bank_1")).rejects.toMatchObject({
      name: "BankHasCardsError",
      count: 1,
    });
    expect(bank.deleteMany).not.toHaveBeenCalled();
  });

  it("treats another user's bank (or an unknown id) as not found, without counting or deleting", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(
      deleteBank(USER_ID, "bank_of_someone_else"),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(account.count).not.toHaveBeenCalled();
    expect(bank.deleteMany).not.toHaveBeenCalled();
  });

  it("reports not found when the row vanished before the delete ran", async () => {
    bank.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteBank(USER_ID, "bank_1")).rejects.toBeInstanceOf(
      BankNotFoundError,
    );
  });

  it("maps the foreign-key refusal of a card saved in the same instant to the cards error", async () => {
    bank.deleteMany.mockRejectedValue(
      Object.assign(new Error("fk"), { code: "P2003" }),
    );
    account.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    db.card.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(deleteBank(USER_ID, "bank_1")).rejects.toBeInstanceOf(
      BankHasCardsError,
    );
  });

  it("maps the foreign-key refusal of an account saved in the same instant to the accounts error", async () => {
    bank.deleteMany.mockRejectedValue(
      Object.assign(new Error("fk"), { code: "P2003" }),
    );
    account.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(deleteBank(USER_ID, "bank_1")).rejects.toBeInstanceOf(
      BankHasAccountsError,
    );
  });

  it("lets an unexpected database error through untouched", async () => {
    const boom = new Error("connection lost");

    bank.deleteMany.mockRejectedValue(boom);

    await expect(deleteBank(USER_ID, "bank_1")).rejects.toBe(boom);
  });
});

describe("unarchiveBank", () => {
  it("brings back the user's archived bank; its accounts stay archived", async () => {
    bank.updateMany.mockResolvedValue({ count: 1 });

    await expect(unarchiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();

    expect(bank.updateMany).toHaveBeenCalledWith({
      where: { id: "bank_1", userId: USER_ID, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });

  it("treats another user's bank (or an unknown id) as not found", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue(null);

    await expect(
      unarchiveBank(USER_ID, "bank_of_someone_else"),
    ).rejects.toBeInstanceOf(BankNotFoundError);
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { id: "bank_of_someone_else", userId: USER_ID },
      select: { id: true },
    });
  });

  it("does nothing, without failing, for a bank that is already active", async () => {
    bank.updateMany.mockResolvedValue({ count: 0 });
    bank.findFirst.mockResolvedValue({ id: "bank_1" });

    await expect(unarchiveBank(USER_ID, "bank_1")).resolves.toBeUndefined();
  });
});
