import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  // The installments' new dates go out as one raw statement: (strings, ids, dates, userId).
  $executeRaw: vi.fn(),
  expense: { createMany: vi.fn(), updateMany: vi.fn() },
  recurringExpense: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  recurringExpenseDecision: { createMany: vi.fn() },
  installmentPlan: { findMany: vi.fn() },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);

import { AccountArchivedError } from "@/core/accounts/errors";
import { InvalidInstallmentCountError } from "@/core/installments/errors";

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
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
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
  db.$executeRaw.mockResolvedValue(0);
  expense.createMany.mockResolvedValue({ count: 0 });
  expense.updateMany.mockResolvedValue({ count: 0 });
  recurringExpense.updateMany.mockResolvedValue({ count: 0 });
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
        accountId: "acc_1",
        originCurrency: null,
        originAmount: null,
        dayOfMonth: 5,
        decision: null,
      },
    ]);
  });

  it("carries the reference price of a template, with its amount as a number", async () => {
    recurringExpense.findMany.mockResolvedValue([
      templateRow({ originCurrency: "USD", originAmount: BigInt(2000) }),
    ]);

    const [item] = await listRecurringExpenses(USER_ID, MONTH);

    expect(item).toMatchObject({ originCurrency: "USD", originAmount: 2000 });
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
            accountId: "acc_1",
            originCurrency: null,
            originAmount: null,
            date: new Date("2026-10-05T00:00:00.000Z"),
            status: "PLANNED",
            isRecurring: true,
            recurringExpenseId: "rec_1",
          },
        ],
        skipDuplicates: true,
      });
    });

    it("copies the reference price of the template onto the expense it creates", async () => {
      await apply(
        [{ recurringExpenseId: "rec_1", choice: "enable", amount: "40000" }],
        [templateRow({ originCurrency: "USD", originAmount: BigInt(2000) })],
      );

      expect(expense.createMany.mock.calls[0][0].data[0]).toMatchObject({
        amount: BigInt(4000000),
        originCurrency: "USD",
        originAmount: BigInt(2000),
      });
    });

    it("creates the month's expense in the account of its template", async () => {
      await apply(
        [
          { recurringExpenseId: "rec_1", choice: "enable" },
          { recurringExpenseId: "rec_2", choice: "enable" },
        ],
        [
          templateRow({ accountId: "acc_cash" }),
          templateRow({ id: "rec_2", accountId: "acc_bank" }),
        ],
      );

      expect(
        expense.createMany.mock.calls[0][0].data.map(
          (row: { accountId: string }) => row.accountId,
        ),
      ).toEqual(["acc_cash", "acc_bank"]);
    });

    it("creates the expense in the template's account even if it was archived since, without checking it again", async () => {
      // The account guard would refuse an archived account: the wizard must not ask it.
      usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

      await apply(
        [{ recurringExpenseId: "rec_1", choice: "enable" }],
        [templateRow({ accountId: "acc_archived" })],
      );

      expect(expense.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: USER_ID,
            description: "Rent",
            amount: BigInt(35000050),
            currency: "ARS",
            categoryId: "cat_1",
            notes: null,
            accountId: "acc_archived",
            originCurrency: null,
            originAmount: null,
            date: new Date("2026-10-05T00:00:00.000Z"),
            status: "PLANNED",
            isRecurring: true,
            recurringExpenseId: "rec_1",
          },
        ],
        skipDuplicates: true,
      });
      expect(usable.assertUsableAccount).not.toHaveBeenCalled();
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

    it("uses the amount typed for the month's expense and keeps it on the template", async () => {
      await apply([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "400000" },
      ]);

      expect(expense.createMany.mock.calls[0][0].data[0].amount).toBe(
        BigInt(40000000),
      );
      expect(recurringExpense.updateMany).toHaveBeenCalledTimes(1);
      expect(recurringExpense.updateMany).toHaveBeenCalledWith({
        where: { id: "rec_1", userId: USER_ID },
        data: { amount: BigInt(40000000) },
      });
      expect(recurringExpense.deleteMany).not.toHaveBeenCalled();
    });

    it("leaves the template alone when the amount is the template's own", async () => {
      await apply([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "350000.50" },
      ]);

      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
    });

    it("leaves the template alone when no amount is sent", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "enable" }]);

      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
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
      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
    });

    it("keeps a changed amount on the template, without creating an expense", async () => {
      await apply([
        { recurringExpenseId: "rec_1", choice: "disable", amount: "410000" },
      ]);

      expect(recurringExpense.updateMany).toHaveBeenCalledWith({
        where: { id: "rec_1", userId: USER_ID },
        data: { amount: BigInt(41000000) },
      });
      expect(expense.createMany).not.toHaveBeenCalled();
      expect(recurringExpenseDecision.createMany).toHaveBeenCalledWith({
        data: [
          { recurringExpenseId: "rec_1", month: MONTH, decision: "DISABLED" },
        ],
        skipDuplicates: true,
      });
    });

    it("leaves the template alone when the amount is the template's own", async () => {
      await apply([
        { recurringExpenseId: "rec_1", choice: "disable", amount: "350000.50" },
      ]);

      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an invalid amount and writes nothing at all", async () => {
      await expect(
        apply([
          { recurringExpenseId: "rec_1", choice: "disable", amount: "abc" },
        ]),
      ).rejects.toBeInstanceOf(InvalidRecurringAmountError);
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("ignores a typed amount, since the template goes away", async () => {
      await apply([
        { recurringExpenseId: "rec_1", choice: "remove", amount: "999" },
      ]);

      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
    });

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

    it("updates the templates' amounts inside the same transaction as the decisions", async () => {
      let inTransaction = false;
      const updatedInside: boolean[] = [];

      db.$transaction.mockImplementation(
        async (run: (tx: typeof db) => unknown) => {
          inTransaction = true;

          try {
            return await run(db);
          } finally {
            inTransaction = false;
          }
        },
      );
      recurringExpense.updateMany.mockImplementation(async () => {
        updatedInside.push(inTransaction);

        return { count: 1 };
      });

      await apply(
        [
          { recurringExpenseId: "a", choice: "enable", amount: "1" },
          { recurringExpenseId: "b", choice: "disable", amount: "2" },
          { recurringExpenseId: "c", choice: "disable", amount: "350000.50" },
        ],
        [
          templateRow({ id: "a" }),
          templateRow({ id: "b" }),
          templateRow({ id: "c" }),
        ],
      );

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(updatedInside).toEqual([true, true]);
      expect(
        recurringExpense.updateMany.mock.calls.map(([arg]) => arg),
      ).toEqual([
        { where: { id: "a", userId: USER_ID }, data: { amount: BigInt(100) } },
        { where: { id: "b", userId: USER_ID }, data: { amount: BigInt(200) } },
      ]);
    });

    it("ignores templates that are not the user's", async () => {
      await apply([{ recurringExpenseId: "someone_elses", choice: "remove" }]);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(recurringExpense.deleteMany).not.toHaveBeenCalled();
    });

    it("ignores templates that already have a decision for the month, so a second submit changes nothing", async () => {
      await apply(
        [{ recurringExpenseId: "rec_1", choice: "enable", amount: "999" }],
        [templateRow({ decisions: [{ decision: "ENABLED" }] })],
      );

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(expense.createMany).not.toHaveBeenCalled();
      expect(recurringExpense.updateMany).not.toHaveBeenCalled();
    });

    it("does nothing for an empty list", async () => {
      await apply([]);

      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("does not even read the installment plans when no count is asked for", async () => {
      await apply([{ recurringExpenseId: "rec_1", choice: "enable" }]);

      expect(db.installmentPlan.findMany).not.toHaveBeenCalled();
    });
  });
});

describe("applyRecurringDecisions with installment counts", () => {
  const installmentRow = (
    number: number,
    date: string,
    status: "PLANNED" | "SETTLED" | "COVERED" = "PLANNED",
  ) => ({
    id: `exp_${number}`,
    installmentNumber: number,
    date: new Date(`${date}T00:00:00.000Z`),
    amount: BigInt(1000),
    status,
  });

  // #1 paid in October, then one per month: #2 November, #3 December, #4 January.
  const planRow = (patch: Record<string, unknown> = {}) => ({
    id: "plan_1",
    userId: USER_ID,
    description: "Heladera",
    totalCuotas: 4,
    currency: "ARS",
    dayOfMonth: 5,
    category: { name: "Hogar" },
    expenses: [
      installmentRow(1, "2026-10-05", "SETTLED"),
      installmentRow(2, "2026-11-05"),
      installmentRow(3, "2026-12-05"),
      installmentRow(4, "2027-01-05"),
    ],
    ...patch,
  });

  const apply = (
    counts: Parameters<typeof applyRecurringDecisions>[3],
    {
      decisions = [],
      templates = [templateRow()],
      plans = [planRow()],
    }: {
      decisions?: Parameters<typeof applyRecurringDecisions>[2];
      templates?: ReturnType<typeof templateRow>[];
      plans?: ReturnType<typeof planRow>[];
    } = {},
  ) => {
    recurringExpense.findMany.mockResolvedValue(templates);
    db.installmentPlan.findMany.mockResolvedValue(plans);

    return applyRecurringDecisions(USER_ID, "2026-11", decisions, counts);
  };

  // What the single raw statement was asked to write: id -> new date.
  const datesWritten = (): [string, string][] =>
    db.$executeRaw.mock.calls.flatMap((call) => {
      const [, ids, dates] = call as unknown as [
        TemplateStringsArray,
        string[],
        string[],
      ];

      return ids.map((id, index): [string, string] => [id, dates[index]]);
    });

  it("reads only the user's plans", async () => {
    await apply([{ planId: "plan_1", count: 1 }]);

    expect(db.installmentPlan.findMany.mock.calls[0][0].where).toMatchObject({
      userId: USER_ID,
    });
  });

  it("moves the pending installments so that the chosen number falls in the month, in one statement scoped to the user", async () => {
    await apply([{ planId: "plan_1", count: 2 }]);

    const [strings, , , userId] = db.$executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      string[],
      string[],
      string,
    ];

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(datesWritten()).toEqual([
      ["exp_3", "2026-11-05"],
      ["exp_4", "2026-12-05"],
    ]);
    expect(userId).toBe(USER_ID);
    expect(strings.join("?")).toContain('UPDATE "Expense"');
    expect(expense.updateMany).not.toHaveBeenCalled();
  });

  it("needs no transaction when only the installments move: one statement is atomic", async () => {
    await apply([{ planId: "plan_1", count: 2 }]);

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("pushes the whole plan back a month when none falls in the month", async () => {
    await apply([{ planId: "plan_1", count: 0 }]);

    expect(datesWritten()).toEqual([
      ["exp_2", "2026-12-05"],
      ["exp_3", "2027-01-05"],
      ["exp_4", "2027-02-05"],
    ]);
  });

  it("writes a 12-installment plan with a constant number of calls", async () => {
    await apply([{ planId: "plan_1", count: 0 }], {
      plans: [
        planRow({
          totalCuotas: 12,
          expenses: Array.from({ length: 12 }, (_, index) =>
            installmentRow(
              index + 1,
              new Date(Date.UTC(2026, 10 + index, 5))
                .toISOString()
                .slice(0, 10),
            ),
          ),
        }),
      ],
    });

    expect(datesWritten()).toHaveLength(12);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(expense.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reads the templates and the plans at the same time", async () => {
    recurringExpense.findMany.mockResolvedValue([templateRow()]);
    db.installmentPlan.findMany.mockResolvedValue([planRow()]);

    const pending = applyRecurringDecisions(
      USER_ID,
      "2026-11",
      [],
      [{ planId: "plan_1", count: 2 }],
    );

    // Both reads were issued before either one was awaited.
    expect(recurringExpense.findMany).toHaveBeenCalledTimes(1);
    expect(db.installmentPlan.findMany).toHaveBeenCalledTimes(1);

    await pending;
  });

  it("writes nothing when the layout is already the chosen one, so a second submit changes nothing", async () => {
    await apply([{ planId: "plan_1", count: 1 }]);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("ignores a plan that is not among the user's", async () => {
    await apply([{ planId: "someone_elses", count: 0 }]);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("never touches an installment that is paid or covered", async () => {
    await apply([{ planId: "plan_1", count: 0 }], {
      plans: [
        planRow({
          expenses: [
            installmentRow(1, "2026-10-05", "SETTLED"),
            installmentRow(2, "2026-11-05", "COVERED"),
            installmentRow(3, "2026-11-20"),
          ],
        }),
      ],
    });

    expect(datesWritten()).toEqual([["exp_3", "2026-12-05"]]);
  });

  it("rejects a count above the pending installments and writes nothing at all", async () => {
    await expect(
      apply([{ planId: "plan_1", count: 4 }], {
        decisions: [{ recurringExpenseId: "rec_1", choice: "enable" }],
      }),
    ).rejects.toBeInstanceOf(InvalidInstallmentCountError);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(expense.createMany).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("applies the recurring decisions and the installment counts in one transaction", async () => {
    await apply([{ planId: "plan_1", count: 2 }], {
      decisions: [{ recurringExpenseId: "rec_1", choice: "enable" }],
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(expense.createMany).toHaveBeenCalledTimes(1);
    expect(recurringExpenseDecision.createMany).toHaveBeenCalledTimes(1);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(datesWritten()).toHaveLength(2);
  });

  it("writes the dates inside the transaction when there are decisions to apply with them", async () => {
    let inTransaction = false;
    const movedInside: boolean[] = [];

    db.$transaction.mockImplementation(
      async (run: (tx: typeof db) => unknown) => {
        inTransaction = true;

        try {
          return await run(db);
        } finally {
          inTransaction = false;
        }
      },
    );
    db.$executeRaw.mockImplementation(async () => {
      movedInside.push(inTransaction);

      return 3;
    });

    await apply([{ planId: "plan_1", count: 0 }], {
      decisions: [{ recurringExpenseId: "rec_1", choice: "enable" }],
    });

    expect(movedInside).toEqual([true]);
  });

  it("applies installment counts alone, with no recurring choice", async () => {
    await apply([{ planId: "plan_1", count: 2 }], { decisions: [] });

    expect(expense.createMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.createMany).not.toHaveBeenCalled();
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("still rejects an invalid recurring amount before touching the installments", async () => {
    await expect(
      apply([{ planId: "plan_1", count: 0 }], {
        decisions: [
          { recurringExpenseId: "rec_1", choice: "enable", amount: "abc" },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidRecurringAmountError);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
