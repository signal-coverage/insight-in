import { describe, expect, it, vi } from "vitest";

import { countAccountMovements, listAccountsWithMovements } from "./movements";

const USER_ID = "user_123";

const counts = (patch: Record<string, number> = {}) => ({
  incomes: 0,
  expenses: 0,
  recurringIncomes: 0,
  recurringExpenses: 0,
  installmentPlans: 0,
  openingBalances: 0,
  transfersOut: 0,
  transfersIn: 0,
  ...patch,
});

const COUNT_SELECT = {
  incomes: true,
  expenses: true,
  recurringIncomes: true,
  recurringExpenses: true,
  installmentPlans: true,
  openingBalances: true,
  transfersOut: true,
  transfersIn: true,
};

describe("countAccountMovements", () => {
  it("counts everything that points at the user's account", async () => {
    const db = {
      account: {
        findFirst: vi.fn().mockResolvedValue({
          _count: counts({ expenses: 2, openingBalances: 1 }),
        }),
      },
    };

    await expect(
      countAccountMovements(db as never, USER_ID, "acc_1"),
    ).resolves.toBe(3);
    expect(db.account.findFirst).toHaveBeenCalledWith({
      where: { id: "acc_1", userId: USER_ID },
      select: { _count: { select: COUNT_SELECT } },
    });
  });

  it("is zero for an account that is not the user's", async () => {
    const db = { account: { findFirst: vi.fn().mockResolvedValue(null) } };

    await expect(
      countAccountMovements(db as never, USER_ID, "acc_x"),
    ).resolves.toBe(0);
  });
});

describe("listAccountsWithMovements", () => {
  it("lists the user's accounts that anything points at, in one query", async () => {
    const db = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc_1", _count: counts({ recurringIncomes: 1 }) },
          { id: "acc_2", _count: counts() },
          { id: "acc_3", _count: counts({ installmentPlans: 1 }) },
        ]),
      },
    };

    await expect(
      listAccountsWithMovements(db as never, USER_ID),
    ).resolves.toEqual(new Set(["acc_1", "acc_3"]));
    expect(db.account.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: { id: true, _count: { select: COUNT_SELECT } },
    });
  });
});

describe("transfers pin an account", () => {
  it("count as movements on both sides: an account with transfers cannot change its currency", async () => {
    const db = {
      account: {
        findFirst: vi.fn().mockResolvedValue({
          _count: counts({ transfersOut: 1, transfersIn: 2 }),
        }),
      },
    };

    await expect(
      countAccountMovements(db as never, USER_ID, "acc_1"),
    ).resolves.toBe(3);
  });

  it("flag an account that only has a transfer coming in", async () => {
    const db = {
      account: {
        findMany: vi.fn().mockResolvedValue([
          { id: "acc_1", _count: counts({ transfersIn: 1 }) },
          { id: "acc_2", _count: counts() },
        ]),
      },
    };

    await expect(
      listAccountsWithMovements(db as never, USER_ID),
    ).resolves.toEqual(new Set(["acc_1"]));
  });
});
