import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  installmentPlan: { findFirst: vi.fn(), deleteMany: vi.fn() },
  expense: { deleteMany: vi.fn() },
  income: { deleteMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { InstallmentPlanNotFoundError } from "./errors";
import { deleteInstallmentPlan } from "./deleteService";

const { expense, income, installmentPlan } = db;

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  installmentPlan.findFirst.mockResolvedValue({ id: "plan_1" });
  installmentPlan.deleteMany.mockResolvedValue({ count: 1 });
  expense.deleteMany.mockResolvedValue({ count: 0 });
  income.deleteMany.mockResolvedValue({ count: 0 });
});

describe("deleteInstallmentPlan", () => {
  it("looks the plan up by owner before deleting anything", async () => {
    await deleteInstallmentPlan(USER_ID, "plan_1");

    expect(installmentPlan.findFirst).toHaveBeenCalledWith({
      where: { id: "plan_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("deletes nothing and fails when the plan is not the user's (or is gone)", async () => {
    installmentPlan.findFirst.mockResolvedValue(null);

    await expect(
      deleteInstallmentPlan(USER_ID, "plan_other"),
    ).rejects.toBeInstanceOf(InstallmentPlanNotFoundError);
    expect(expense.deleteMany).not.toHaveBeenCalled();
    expect(income.deleteMany).not.toHaveBeenCalled();
    expect(installmentPlan.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes every expense of the plan, paid or not, and only the user's", async () => {
    expense.deleteMany.mockResolvedValue({ count: 12 });

    await deleteInstallmentPlan(USER_ID, "plan_1");

    expect(expense.deleteMany).toHaveBeenCalledWith({
      where: { installmentPlanId: "plan_1", userId: USER_ID },
    });
  });

  it("deletes every income of the plan, paid or not, and only the user's", async () => {
    income.deleteMany.mockResolvedValue({ count: 6 });

    await deleteInstallmentPlan(USER_ID, "plan_1");

    expect(income.deleteMany).toHaveBeenCalledWith({
      where: { installmentPlanId: "plan_1", userId: USER_ID },
    });
  });

  it("deletes the plan itself, scoped by owner", async () => {
    await deleteInstallmentPlan(USER_ID, "plan_1");

    expect(installmentPlan.deleteMany).toHaveBeenCalledWith({
      where: { id: "plan_1", userId: USER_ID },
    });
  });

  it("deletes the entries before the plan, so none is left orphaned", async () => {
    await deleteInstallmentPlan(USER_ID, "plan_1");

    const plan = installmentPlan.deleteMany.mock.invocationCallOrder[0];

    expect(expense.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(plan);
    expect(income.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(plan);
  });

  it("does everything in one transaction", async () => {
    await deleteInstallmentPlan(USER_ID, "plan_1");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns how many entries were removed (an expense plan)", async () => {
    expense.deleteMany.mockResolvedValue({ count: 12 });

    expect(await deleteInstallmentPlan(USER_ID, "plan_1")).toBe(12);
  });

  it("returns how many entries were removed (an income plan)", async () => {
    income.deleteMany.mockResolvedValue({ count: 6 });

    expect(await deleteInstallmentPlan(USER_ID, "plan_1")).toBe(6);
  });

  it("still deletes a plan that has no entries left, returning zero", async () => {
    expect(await deleteInstallmentPlan(USER_ID, "plan_1")).toBe(0);
    expect(installmentPlan.deleteMany).toHaveBeenCalled();
  });
});
