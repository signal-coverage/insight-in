import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  ensureDefaultCash: vi.fn(),
  listBanksWithAccounts: vi.fn(),
  readAccountBalances: vi.fn(),
  listAccountsWithMovements: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: { tag: "prisma" } }));
vi.mock("@/core/accounts/defaultCash", () => ({
  ensureDefaultCash: deps.ensureDefaultCash,
}));
vi.mock("@/core/balances/accountBalances", () => ({
  readAccountBalances: deps.readAccountBalances,
}));
vi.mock("@/core/accounts/movements", () => ({
  listAccountsWithMovements: deps.listAccountsWithMovements,
}));
vi.mock("./service", () => ({
  listBanksWithAccounts: deps.listBanksWithAccounts,
}));

import { loadBanksBoard } from "./pageData";

beforeEach(() => {
  vi.resetAllMocks();
  deps.readAccountBalances.mockResolvedValue([]);
  deps.listAccountsWithMovements.mockResolvedValue(new Set());
});

describe("loadBanksBoard", () => {
  it("makes sure the user has the default cash bank before it reads the board", async () => {
    const calls: string[] = [];

    deps.ensureDefaultCash.mockImplementation(async () => {
      calls.push("ensure");
    });
    deps.listBanksWithAccounts.mockImplementation(async () => {
      calls.push("list");

      return [];
    });

    await loadBanksBoard("user_1");

    expect(calls).toEqual(["ensure", "list"]);
    expect(deps.ensureDefaultCash).toHaveBeenCalledWith("user_1");
    expect(deps.listBanksWithAccounts).toHaveBeenCalledWith("user_1");
  });

  it("gives the banks with each account's balance and whether it has movements", async () => {
    deps.ensureDefaultCash.mockResolvedValue(undefined);
    deps.listBanksWithAccounts.mockResolvedValue([
      {
        id: "bank_1",
        name: "Efectivo",
        kind: "ENTITY",
        archived: false,
        accounts: [
          {
            id: "acc_1",
            bankId: "bank_1",
            name: "Efectivo",
            currency: "ARS",
            archived: false,
          },
        ],
      },
    ]);
    deps.readAccountBalances.mockResolvedValue([
      { accountId: "acc_1", currency: "ARS", balance: 50000 },
    ]);
    deps.listAccountsWithMovements.mockResolvedValue(new Set(["acc_1"]));

    const [bank] = await loadBanksBoard("user_1");

    expect(deps.readAccountBalances).toHaveBeenCalledWith(
      { tag: "prisma" },
      "user_1",
    );
    expect(deps.listAccountsWithMovements).toHaveBeenCalledWith(
      { tag: "prisma" },
      "user_1",
    );
    expect(bank.accounts[0]).toMatchObject({
      balance: 50000,
      hasMovements: true,
    });
    expect(bank.accounts[0].balanceLabel).toMatch(/500,00/);
  });

  it("does not read the board when the seeding fails, so the failure reaches the error boundary", async () => {
    deps.ensureDefaultCash.mockRejectedValue(new Error("database down"));

    await expect(loadBanksBoard("user_1")).rejects.toThrow("database down");
    expect(deps.listBanksWithAccounts).not.toHaveBeenCalled();
  });
});
