import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  expense: { createMany: vi.fn(), updateMany: vi.fn() },
  recurringExpense: { findMany: vi.fn(), deleteMany: vi.fn() },
  recurringExpenseDecision: { createMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { InvalidRecurringAmountError } from "./errors";
import {
  applyRecurringDecisions,
  listRecurringExpenses,
} from "./recurringService";

const { expense, recurringExpense, recurringExpenseDecision } = db;

const USER_ID = "user_123";
const MONTH = "2026-10";

const templateRow = (patch: Record<string, unknown> = {}) => ({
  id: "rec_1",
  userId: USER_ID,
  description: "Rent",
  amount: BigInt(35000050),
  currency: "ARS",
  categoryId: "cat_1",
  category: { name: "Alquiler" },
  notes: null,
  dayOfMonth: 5,
  decisions: [],
  createdAt: new Date("2026-09-06T10:00:00.000Z"),
  updatedAt: new Date("2026-09-06T10:00:00.000Z"),
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  expense.createMany.mockResolvedValue({ count: 0 });
  expense.updateMany.mockResolvedValue({ count: 0 });
  recurringExpense.deleteMany.mockResolvedValue({ count: 0 });
  recurringExpenseDecision.createMany.mockResolvedValue({ count: 0 });
});

describe("listRecurringExpenses", () => {
  it("reads only the user's templates, with what was decided for that month", async () => {
    recurringExpense.findMany.mockResolvedValue([]);

    await listRecurringExpenses(USER_ID, MONTH);

    expect(recurringExpense.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: {
        category: { select: { name: true } },
        decisions: { where: { month: MONTH }, select: { decision: true } },
      },
      orderBy: [{ dayOfMonth: "asc" }, { description: "asc" }],
    });
  });

  it("returns plain objects, with no decision for a template nobody decided about", async () => {
    recurringExpense.findMany.mockResolvedValue([templateRow()]);

    await expect(listRecurringExpenses(USER_ID, MONTH)).resolves.toEqual([
      {
        id: "rec_1",
        description: "Rent",
        amount: 35000050,
        currency: "ARS",
        categoryId: "cat_1",
        categoryName: "Alquiler",
        notes: null,
        dayOfMonth: 5,
        decision: null,
      },
    ]);
  });

  it("carries the decision made for the month", async () => {
    recurringExpense.findMany.mockResolvedValue([
      templateRow({ decisions: [{ decision: "DISABLED" }] }),
    ]);

    const [item] = await listRecurringExpenses(USER_ID, MONTH);

    expect(item.decision).toBe("DISABLED");
  });
});

describe("applyRecurringDecisions", () => {
  const apply = (
    requested: Parameters<typeof applyRecurringDecisions>[2],
    templates = [templateRow()],
  ) => {
    recurringExpense.findMany.mockResolvedValue(templates);

    return applyRecurringDecisions(USER_ID, MONTH, requested);
  };

  describe("enable", () => {
    it("creates a pending expense copied from the template, on its day of the month", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "enable" }]);

      expect(expense.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: USER_ID,
            description: "Rent",
            amount: BigInt(35000050),
            currency: "ARS",
            categoryId: "cat_1",
            notes: null,
            date: new Date("2026-10-05T00:00:00.000Z"),
            status: "PLANNED",
            isRecurring: true,
            recurringExpenseId: "rec_1",
          },
        ],
        skipDuplicates: true,
      });
    });

    it("uses the last day of a shorter month", async () => {
      await apply(
        [{ recurringExpenseId: "rec_1", choice: "enable" }],
        [templateRow({ dayOfMonth: 31 })],
      );

      expect(expense.createMany.mock.calls[0][0].data[0].date).toEqual(
        new Date("2026-10-31T00:00:00.000Z"),
      );
    });

    it("uses the amount typed for this month without changing the template", async () => {
      await apply([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "400000" },
      ]);

      expect(expense.createMany.mock.calls[0][0].data[0].amount).toBe(
        BigInt(40000000),
      );
      expect(recurringExpense.deleteMany).not.toHaveBeenCalled();
    });

    it("records an enabled decision for the month", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "enable" }]);

      expect(recurringExpenseDecision.createMany).toHaveBeenCalledWith({
        data: [
          { recurringExpenseId: "rec_1", month: MONTH, decision: "ENABLED" },
        ],
        skipDuplicates: true,
      });
    });

    it("rejects an invalid amount and writes nothing at all", async () => {
      await expect(
        apply([
          { recurringExpenseId: "rec_1", choice: "enable", amount: "abc" },
        ]),
      ).rejects.toBeInstanceOf(InvalidRecurringAmountError);
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("disable", () => {
    it("only records the decision: no expense, and the template stays", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "disable" }]);

      expect(recurringExpenseDecision.createMany).toHaveBeenCalledWith({
        data: [
          { recurringExpenseId: "rec_1", month: MONTH, decision: "DISABLED" },
        ],
        skipDuplicates: true,
      });
      expect(expense.createMany).not.toHaveBeenCalled();
      expect(recurringExpense.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes the template, scoped to the user", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "remove" }]);

      expect(recurringExpense.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["rec_1"] }, userId: USER_ID },
      });
    });

    it("keeps the expenses already created from it, as ordinary ones", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "remove" }]);

      expect(expense.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, recurringExpenseId: { in: ["rec_1"] } },
        data: { isRecurring: false },
      });
      expect(expense.createMany).not.toHaveBeenCalled();
    });

    it("clears the flag before the template goes, while the link still exists", async () => {
      const order: string[] = [];

      expense.updateMany.mockImplementation(async () => {
        order.push("flag");

        return { count: 1 };
      });
      recurringExpense.deleteMany.mockImplementation(async () => {
        order.push("delete");

        return { count: 1 };
      });

      await apply([{ recurringExpenseId: "rec_1", choice: "remove" }]);

      expect(order).toEqual(["flag", "delete"]);
    });
  });

  describe("as a whole", () => {
    it("does every choice in one transaction", async () => {
      await apply(
        [
          { recurringExpenseId: "a", choice: "enable" },
          { recurringExpenseId: "b", choice: "disable" },
          { recurringExpenseId: "c", choice: "remove" },
        ],
        [
          templateRow({ id: "a" }),
          templateRow({ id: "b" }),
          templateRow({ id: "c" }),
        ],
      );

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(expense.createMany.mock.calls[0][0].data).toHaveLength(1);
      expect(
        recurringExpenseDecision.createMany.mock.calls.flatMap(
          ([{ data }]) => data,
        ),
      ).toHaveLength(2);
      expect(recurringExpense.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["c"] }, userId: USER_ID },
      });
    });

    it("ignores templates that are not the user's", async () => {
      await apply([{ recurringExpenseId: "someone_elses", choice: "remove" }]);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(recurringExpense.deleteMany).not.toHaveBeenCalled();
    });

    it("ignores templates that already have a decision for the month, so a second submit changes nothing", async () => {
      await apply(
        [{ recurringExpenseId: "rec_1", choice: "enable" }],
        [templateRow({ decisions: [{ decision: "ENABLED" }] })],
      );

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(expense.createMany).not.toHaveBeenCalled();
    });

    it("does nothing for an empty list", async () => {
      await apply([]);

      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });
});
