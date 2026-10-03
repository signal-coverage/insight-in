import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { deleteMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { deleteIncomes } from "./service";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deleteIncomes", () => {
  it("deletes every id in one statement, scoped to the user", async () => {
    db.income.deleteMany.mockResolvedValue({ count: 2 });

    await expect(deleteIncomes(USER_ID, ["inc_1", "inc_2"])).resolves.toBe(2);
    expect(db.income.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.income.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["inc_1", "inc_2"] }, userId: USER_ID },
    });
  });

  it("counts only the records that matched (others were gone or not the user's)", async () => {
    db.income.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteIncomes(USER_ID, ["inc_1", "inc_9"])).resolves.toBe(1);
  });

  it("returns zero when nothing matched", async () => {
    db.income.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteIncomes(USER_ID, ["inc_9"])).resolves.toBe(0);
  });
});
