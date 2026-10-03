import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  expense: { groupBy: vi.fn() },
  income: { groupBy: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { listExpensePlanProgress, listIncomePlanProgress } from "./progress";

const USER_ID = "user_123";

const group = (
  installmentPlanId: string | null,
  status: "PLANNED" | "SETTLED" | "COVERED",
  count: number,
) => ({ installmentPlanId, status, _count: { _all: count } });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listExpensePlanProgress", () => {
  it("reads nothing when there are no plans", async () => {
    expect(await listExpensePlanProgress(USER_ID, [])).toEqual({});
    expect(db.expense.groupBy).not.toHaveBeenCalled();
  });

  it("counts all the plans with one grouped query, scoped by owner", async () => {
    db.expense.groupBy.mockResolvedValue([
      group("plan_1", "PLANNED", 2),
      group("plan_1", "SETTLED", 1),
    ]);

    const progress = await listExpensePlanProgress(USER_ID, [
      "plan_1",
      "plan_2",
    ]);

    expect(db.expense.groupBy).toHaveBeenCalledTimes(1);
    expect(db.expense.groupBy).toHaveBeenCalledWith({
      by: ["installmentPlanId", "status"],
      where: {
        userId: USER_ID,
        installmentPlanId: { in: ["plan_1", "plan_2"] },
      },
      _count: { _all: true },
    });
    expect(progress).toEqual({ plan_1: { total: 3, settled: 1 } });
  });
});

describe("listIncomePlanProgress", () => {
  it("reads nothing when there are no plans", async () => {
    expect(await listIncomePlanProgress(USER_ID, [])).toEqual({});
    expect(db.income.groupBy).not.toHaveBeenCalled();
  });

  it("counts all the plans with one grouped query, scoped by owner", async () => {
    db.income.groupBy.mockResolvedValue([
      group("plan_1", "PLANNED", 5),
      group("plan_1", "SETTLED", 1),
    ]);

    const progress = await listIncomePlanProgress(USER_ID, ["plan_1"]);

    expect(db.income.groupBy).toHaveBeenCalledWith({
      by: ["installmentPlanId", "status"],
      where: { userId: USER_ID, installmentPlanId: { in: ["plan_1"] } },
      _count: { _all: true },
    });
    expect(progress).toEqual({ plan_1: { total: 6, settled: 1 } });
  });
});
