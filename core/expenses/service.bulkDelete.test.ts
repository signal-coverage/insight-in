import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  expense: { deleteMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { deleteExpenses } from "./service";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deleteExpenses", () => {
  it("deletes every id in one statement, scoped to the user", async () => {
    db.expense.deleteMany.mockResolvedValue({ count: 2 });

    await expect(deleteExpenses(USER_ID, ["exp_1", "exp_2"])).resolves.toBe(2);
    expect(db.expense.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.expense.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["exp_1", "exp_2"] }, userId: USER_ID },
    });
  });

  it("counts only the records that matched (others were gone or not the user's)", async () => {
    db.expense.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteExpenses(USER_ID, ["exp_1", "exp_9"])).resolves.toBe(1);
  });

  it("returns zero when nothing matched", async () => {
    db.expense.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteExpenses(USER_ID, ["exp_9"])).resolves.toBe(0);
  });
});
