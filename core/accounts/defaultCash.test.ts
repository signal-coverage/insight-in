import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are observed
  // on the same mocks.
  $transaction: vi.fn(),
  bank: { count: vi.fn(), createMany: vi.fn(), findFirst: vi.fn() },
  account: { createMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { ensureDefaultCash } from "./defaultCash";

const { bank, account } = db;

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  bank.count.mockResolvedValue(0);
  bank.createMany.mockResolvedValue({ count: 1 });
  bank.findFirst.mockResolvedValue({ id: "bank_cash" });
  account.createMany.mockResolvedValue({ count: 1 });
});

describe("ensureDefaultCash", () => {
  it("creates the bank 'Efectivo' with an account 'Efectivo' in ARS, in one transaction", async () => {
    await ensureDefaultCash(USER_ID);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(bank.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, name: "Efectivo" }],
      skipDuplicates: true,
    });
    expect(bank.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, name: "Efectivo" },
      select: { id: true },
    });
    expect(account.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          bankId: "bank_cash",
          name: "Efectivo",
          currency: "ARS",
        },
      ],
      skipDuplicates: true,
    });
  });

  it("only looks at the banks of the user", async () => {
    await ensureDefaultCash(USER_ID);

    expect(bank.count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it("does nothing for a user who already has a bank: a renamed or archived 'Efectivo' is never brought back", async () => {
    bank.count.mockResolvedValue(1);

    await ensureDefaultCash(USER_ID);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(bank.createMany).not.toHaveBeenCalled();
    expect(account.createMany).not.toHaveBeenCalled();
  });

  it("is safe when two requests race: the constraint swallows the second insert and neither fails", async () => {
    bank.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    account.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      Promise.all([ensureDefaultCash(USER_ID), ensureDefaultCash(USER_ID)]),
    ).resolves.toEqual([undefined, undefined]);

    // Both inserts skip duplicates: a plain create would throw on the unique constraint (and the
    // mock has no `create`, so it would fail here).
    expect(bank.createMany).toHaveBeenCalledTimes(2);
    expect(
      bank.createMany.mock.calls.every(([arg]) => arg.skipDuplicates),
    ).toBe(true);
    expect(account.createMany).toHaveBeenCalledTimes(2);
    expect(
      account.createMany.mock.calls.every(([arg]) => arg.skipDuplicates),
    ).toBe(true);
  });

  it("is idempotent: calling it again after the seed (the bank now exists) writes nothing more", async () => {
    await ensureDefaultCash(USER_ID);
    bank.count.mockResolvedValue(1);

    await ensureDefaultCash(USER_ID);

    // Totals across both calls: only the first one wrote.
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(bank.createMany).toHaveBeenCalledTimes(1);
    expect(account.createMany).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when the bank cannot be read back, so no account is created without a bank", async () => {
    bank.findFirst.mockResolvedValue(null);

    await expect(ensureDefaultCash(USER_ID)).rejects.toThrow(
      "The default cash bank could not be read back",
    );
    expect(account.createMany).not.toHaveBeenCalled();
  });
});
