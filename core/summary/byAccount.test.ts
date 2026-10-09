import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ account: { findMany: vi.fn() } }));
const balances = vi.hoisted(() => ({ readAccountBalances: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/balances/accountBalances", () => balances);

import { listAccountBalanceRows } from "./byAccount";

const USER_ID = "user_123";

const account = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  userId: USER_ID,
  bankId: "bank_1",
  name: `Cuenta ${id}`,
  currency: "ARS",
  archivedAt: null,
  bank: { name: "Galicia" },
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.account.findMany.mockResolvedValue([]);
  balances.readAccountBalances.mockResolvedValue([]);
});

describe("listAccountBalanceRows", () => {
  it("reads the user's accounts in the Banks board's order, and their balances as they are now (every settled movement, transfers included)", async () => {
    await listAccountBalanceRows(USER_ID);

    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { bank: { select: { name: true } } },
      orderBy: [
        { bank: { createdAt: "asc" } },
        { bank: { id: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
    expect(balances.readAccountBalances).toHaveBeenCalledWith(db, USER_ID);
  });

  it("gives each account its balance, 0 for one that has no movement, and flags the archived ones", async () => {
    db.account.findMany.mockResolvedValue([
      account("a1"),
      account("a2", {
        archivedAt: new Date("2026-09-01T00:00:00.000Z"),
        currency: "USD",
      }),
    ]);
    balances.readAccountBalances.mockResolvedValue([
      { accountId: "a1", currency: "ARS", balance: -250 },
    ]);

    expect(await listAccountBalanceRows(USER_ID)).toEqual([
      {
        accountId: "a1",
        accountName: "Cuenta a1",
        bankId: "bank_1",
        bankName: "Galicia",
        currency: "ARS",
        balance: -250,
        archived: false,
      },
      {
        accountId: "a2",
        accountName: "Cuenta a2",
        bankId: "bank_1",
        bankName: "Galicia",
        currency: "USD",
        balance: 0,
        archived: true,
      },
    ]);
  });
});
