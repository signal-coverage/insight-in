import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  // The reflow's dates go out as one raw statement: (strings, ids, dates, userId).
  $executeRaw: vi.fn(),
  installmentPlan: { create: vi.fn(), findMany: vi.fn() },
  income: { createMany: vi.fn(), updateMany: vi.fn() },
  incomeCategory: { findFirst: vi.fn() },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);

import { AccountArchivedError } from "@/core/accounts/errors";
import { CategoryNotFoundError } from "@/core/incomes/errors";

import { InvalidInstallmentCountError } from "./errors";
import {
  applyIncomeInstallmentCounts,
  createIncomeInstallmentPlan,
  listIncomeInstallmentPlanRows,
  listIncomeInstallmentPlans,
} from "./incomeService";
import type { IncomeInstallmentPlanInput } from "./types";

const { income, incomeCategory, installmentPlan } = db;

const USER_ID = "user_123";

const input: IncomeInstallmentPlanInput = {
  description: "Préstamo a Juan",
  categoryId: "cat_1",
  currency: "ARS",
  accountId: "acc_1",
  notes: "Devuelve en mano",
  totalCuotas: 3,
  totalAmount: 100000,
  firstDate: "2026-10-31",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  incomeCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  installmentPlan.create.mockResolvedValue({ id: "plan_1" });
  income.createMany.mockResolvedValue({ count: 3 });
  income.updateMany.mockResolvedValue({ count: 1 });
  db.$executeRaw.mockResolvedValue(1);
});

describe("createIncomeInstallmentPlan", () => {
  it("verifies the income category belongs to the user before writing anything", async () => {
    await createIncomeInstallmentPlan(USER_ID, input);

    expect(incomeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("writes nothing when the category is not the user's", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);

    await expect(
      createIncomeInstallmentPlan(USER_ID, input),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(installmentPlan.create).not.toHaveBeenCalled();
    expect(income.createMany).not.toHaveBeenCalled();
  });

  it("stores an income plan: the income category, no expense category, no card, and the day of its first installment", async () => {
    await createIncomeInstallmentPlan(USER_ID, input);

    expect(installmentPlan.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        kind: "INCOME",
        description: "Préstamo a Juan",
        totalCuotas: 3,
        totalAmount: BigInt(100000),
        currency: "ARS",
        accountId: "acc_1",
        incomeCategoryId: "cat_1",
        notes: "Devuelve en mano",
        dayOfMonth: 31,
      },
    });
    expect(installmentPlan.create.mock.calls[0][0].data).not.toHaveProperty(
      "categoryId",
    );
    expect(installmentPlan.create.mock.calls[0][0].data).not.toHaveProperty(
      "cardId",
    );
  });

  it("creates every installment as a planned income linked to the plan, with its number, account and notes", async () => {
    await createIncomeInstallmentPlan(USER_ID, input);

    const common = {
      userId: USER_ID,
      currency: "ARS",
      categoryId: "cat_1",
      notes: "Devuelve en mano",
      accountId: "acc_1",
      status: "PLANNED",
      installmentPlanId: "plan_1",
    };

    expect(income.createMany).toHaveBeenCalledWith({
      data: [
        {
          ...common,
          description: "Préstamo a Juan (1/3)",
          amount: BigInt(33334),
          date: new Date("2026-10-31T00:00:00.000Z"),
          installmentNumber: 1,
        },
        {
          ...common,
          description: "Préstamo a Juan (2/3)",
          amount: BigInt(33333),
          date: new Date("2026-11-30T00:00:00.000Z"),
          installmentNumber: 2,
        },
        {
          ...common,
          description: "Préstamo a Juan (3/3)",
          amount: BigInt(33333),
          date: new Date("2026-12-31T00:00:00.000Z"),
          installmentNumber: 3,
        },
      ],
    });
  });

  it("falls back to the last day of a shorter month and goes back to the day afterwards", async () => {
    await createIncomeInstallmentPlan(USER_ID, {
      ...input,
      totalCuotas: 5,
      firstDate: "2027-01-31",
    });

    expect(
      income.createMany.mock.calls[0][0].data.map(({ date }: { date: Date }) =>
        date.toISOString().slice(0, 10),
      ),
    ).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
      "2027-05-31",
    ]);
  });

  it("rolls the installments over the end of the year", async () => {
    await createIncomeInstallmentPlan(USER_ID, {
      ...input,
      firstDate: "2026-11-15",
    });

    expect(
      income.createMany.mock.calls[0][0].data.map(({ date }: { date: Date }) =>
        date.toISOString().slice(0, 10),
      ),
    ).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });

  it("makes the installments add up to exactly the total", async () => {
    await createIncomeInstallmentPlan(USER_ID, {
      ...input,
      totalAmount: 100001,
    });

    const amounts = income.createMany.mock.calls[0][0].data.map(
      ({ amount }: { amount: bigint }) => amount,
    );

    expect(
      amounts.reduce((sum: bigint, amount: bigint) => sum + amount, BigInt(0)),
    ).toBe(BigInt(100001));
  });

  it("puts the plan and every installment in the account chosen", async () => {
    await createIncomeInstallmentPlan(USER_ID, {
      ...input,
      accountId: "acc_cash",
    });

    expect(installmentPlan.create.mock.calls[0][0].data.accountId).toBe(
      "acc_cash",
    );
    expect(
      income.createMany.mock.calls[0][0].data.every(
        ({ accountId }: { accountId: string }) => accountId === "acc_cash",
      ),
    ).toBe(true);
  });

  it("checks the account before writing anything, and writes nothing when it is refused", async () => {
    usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

    await expect(
      createIncomeInstallmentPlan(USER_ID, input),
    ).rejects.toBeInstanceOf(AccountArchivedError);
    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_1",
      currency: input.currency,
      keepAccountId: null,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(installmentPlan.create).not.toHaveBeenCalled();
    expect(income.createMany).not.toHaveBeenCalled();
  });

  it("does the plan and its installments in one transaction", async () => {
    await createIncomeInstallmentPlan(USER_ID, input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("undoes everything, plan included, when the installments cannot be written", async () => {
    let rolledBackWith: unknown;

    db.$transaction.mockImplementation(
      async (run: (tx: typeof db) => unknown) => {
        try {
          return await run(db);
        } catch (error) {
          // A throw inside the callback is what makes the database roll back.
          rolledBackWith = error;
          throw error;
        }
      },
    );
    income.createMany.mockRejectedValue(new Error("db down"));

    await expect(createIncomeInstallmentPlan(USER_ID, input)).rejects.toThrow(
      "db down",
    );
    expect(rolledBackWith).toBeInstanceOf(Error);
  });

  it("returns the id of the plan", async () => {
    await expect(createIncomeInstallmentPlan(USER_ID, input)).resolves.toEqual({
      id: "plan_1",
    });
  });

  it("keeps a missing note as null on the plan and on every installment", async () => {
    await createIncomeInstallmentPlan(USER_ID, { ...input, notes: null });

    expect(installmentPlan.create.mock.calls[0][0].data.notes).toBeNull();
    expect(
      income.createMany.mock.calls[0][0].data.every(
        ({ notes }: { notes: string | null }) => notes === null,
      ),
    ).toBe(true);
  });
});

// A loan repaid in 5 installments on the 5th of each month: two already collected and three to go.
const planRow = (patch: Record<string, unknown> = {}) => ({
  id: "plan_1",
  userId: USER_ID,
  description: "Préstamo a Juan",
  totalCuotas: 5,
  currency: "ARS",
  dayOfMonth: 5,
  incomeCategory: { name: "Préstamos" },
  incomes: [
    {
      id: "i1",
      installmentNumber: 1,
      date: new Date("2026-09-05T00:00:00.000Z"),
      amount: BigInt(2500),
      status: "SETTLED",
    },
    {
      id: "i2",
      installmentNumber: 2,
      date: new Date("2026-10-05T00:00:00.000Z"),
      amount: BigInt(2500),
      status: "SETTLED",
    },
    {
      id: "i3",
      installmentNumber: 3,
      date: new Date("2026-11-05T00:00:00.000Z"),
      amount: BigInt(2501),
      status: "PLANNED",
    },
    {
      id: "i4",
      installmentNumber: 4,
      date: new Date("2026-12-05T00:00:00.000Z"),
      amount: BigInt(2501),
      status: "PLANNED",
    },
    {
      id: "i5",
      installmentNumber: 5,
      date: new Date("2027-01-05T00:00:00.000Z"),
      amount: BigInt(2501),
      status: "PLANNED",
    },
  ],
  ...patch,
});

describe("listIncomeInstallmentPlanRows", () => {
  it("reads only the user's income plans that still have something to collect, in installment order", async () => {
    installmentPlan.findMany.mockResolvedValue([]);

    await listIncomeInstallmentPlanRows(USER_ID);

    expect(installmentPlan.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        kind: "INCOME",
        incomes: { some: { status: "PLANNED" } },
      },
      include: {
        incomeCategory: { select: { name: true } },
        incomes: {
          select: {
            id: true,
            installmentNumber: true,
            date: true,
            amount: true,
            status: true,
          },
          orderBy: { installmentNumber: "asc" },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("returns plain objects with the dates as calendar strings and no card", async () => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);

    const [plan] = await listIncomeInstallmentPlanRows(USER_ID);

    expect(plan).toMatchObject({
      id: "plan_1",
      description: "Préstamo a Juan",
      dayOfMonth: 5,
      categoryName: "Préstamos",
      currency: "ARS",
      totalCuotas: 5,
      cardId: null,
      purchaseDate: null,
    });
    expect(plan.installments[2]).toEqual({
      id: "i3",
      number: 3,
      date: "2026-11-05",
      status: "PLANNED",
      amount: 2501,
    });
  });

  it("leaves out an income that carries no installment number", async () => {
    installmentPlan.findMany.mockResolvedValue([
      planRow({
        incomes: [
          {
            id: "i1",
            installmentNumber: null,
            date: new Date("2026-09-05T00:00:00.000Z"),
            amount: BigInt(2500),
            status: "PLANNED",
          },
        ],
      }),
    ]);

    const [plan] = await listIncomeInstallmentPlanRows(USER_ID);

    expect(plan.installments).toEqual([]);
  });
});

describe("listIncomeInstallmentPlans", () => {
  it("describes each plan for the section: done, pending, next amount and the count already in the month", async () => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);

    await expect(
      listIncomeInstallmentPlans(USER_ID, "2026-11"),
    ).resolves.toEqual([
      {
        id: "plan_1",
        description: "Préstamo a Juan",
        categoryName: "Préstamos",
        currency: "ARS",
        totalCuotas: 5,
        doneCount: 2,
        pendingCount: 3,
        nextAmount: 2501,
        defaultCount: 1,
      },
    ]);
  });

  it("defaults to none for a month in which no pending installment falls", async () => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);

    const [plan] = await listIncomeInstallmentPlans(USER_ID, "2026-08");

    expect(plan.defaultCount).toBe(0);
  });

  it("returns nothing when no plan has an installment left to collect", async () => {
    installmentPlan.findMany.mockResolvedValue([]);

    await expect(
      listIncomeInstallmentPlans(USER_ID, "2026-11"),
    ).resolves.toEqual([]);
  });
});

describe("applyIncomeInstallmentCounts", () => {
  // What the single raw statement was asked to write: id -> new date.
  const datesWritten = (): Record<string, string> =>
    Object.fromEntries(
      db.$executeRaw.mock.calls.flatMap((call) => {
        const [, ids, dates] = call as unknown as [
          TemplateStringsArray,
          string[],
          string[],
        ];

        return ids.map((id, index) => [id, dates[index]]);
      }),
    );

  const sqlSent = (): string =>
    (db.$executeRaw.mock.calls[0][0] as TemplateStringsArray).join("?");

  beforeEach(() => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);
  });

  it("collects none this month: the whole plan moves back from next month", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 0 },
    ]);

    expect(datesWritten()).toEqual({
      i3: "2026-12-05",
      i4: "2027-01-05",
      i5: "2027-02-05",
    });
  });

  it("collects the one that already falls in the month: nothing is written", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 1 },
    ]);

    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("collects two this month: the next one comes in and the rest follow one per month", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 2 },
    ]);

    expect(datesWritten()).toEqual({ i4: "2026-11-05", i5: "2026-12-05" });
  });

  it("collects everything that is left in one month", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 3 },
    ]);

    expect(datesWritten()).toEqual({ i4: "2026-11-05", i5: "2026-11-05" });
  });

  it("refuses more installments than the plan has left, and writes nothing", async () => {
    await expect(
      applyIncomeInstallmentCounts(USER_ID, "2026-11", [
        { planId: "plan_1", count: 4 },
      ]),
    ).rejects.toBeInstanceOf(InvalidInstallmentCountError);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("names the plan in the error", async () => {
    await expect(
      applyIncomeInstallmentCounts(USER_ID, "2026-11", [
        { planId: "plan_1", count: 9 },
      ]),
    ).rejects.toMatchObject({ description: "Préstamo a Juan" });
  });

  it("never moves an installment that was already collected", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 0 },
    ]);

    const written = Object.keys(datesWritten());

    expect(written).not.toContain("i1");
    expect(written).not.toContain("i2");
  });

  it("only writes to installments that are still planned, so one collected meanwhile stays put", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 0 },
    ]);

    expect(sqlSent()).toContain(`"status" = 'PLANNED'`);
  });

  it("writes only the date and scopes the write by user", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 2 },
    ]);

    const [strings, ids, dates, userId] = db.$executeRaw.mock
      .calls[0] as unknown as [
      TemplateStringsArray,
      string[],
      string[],
      string,
    ];

    expect(ids).toEqual(["i4", "i5"]);
    expect(dates).toEqual(["2026-11-05", "2026-12-05"]);
    expect(userId).toBe(USER_ID);
    expect(strings.join("?")).toContain(`"userId" = ?`);
    expect(income.updateMany).not.toHaveBeenCalled();
  });

  it("writes every installment of a 12-installment plan with a constant number of calls", async () => {
    // Twelve pending installments, one per month from November 2026.
    installmentPlan.findMany.mockResolvedValue([
      planRow({
        totalCuotas: 12,
        incomes: Array.from({ length: 12 }, (_, index) => ({
          id: `n${index + 1}`,
          installmentNumber: index + 1,
          date: new Date(Date.UTC(2026, 10 + index, 5)),
          amount: BigInt(1000),
          status: "PLANNED",
        })),
      }),
    ]);

    // Pushing the whole plan one month back changes all twelve dates.
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 0 },
    ]);

    expect(Object.keys(datesWritten())).toHaveLength(12);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(income.updateMany).not.toHaveBeenCalled();
    // One read of the plans plus one write: the cost no longer grows with the installments.
    expect(installmentPlan.findMany).toHaveBeenCalledTimes(1);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("applies all the plans in one statement, which is atomic by itself", async () => {
    installmentPlan.findMany.mockResolvedValue([
      planRow(),
      planRow({
        id: "plan_2",
        incomes: [
          {
            id: "j1",
            installmentNumber: 1,
            date: new Date("2026-12-05T00:00:00.000Z"),
            amount: BigInt(100),
            status: "PLANNED",
          },
        ],
      }),
    ]);

    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 0 },
      { planId: "plan_2", count: 1 },
    ]);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(datesWritten()).toMatchObject({
      i3: "2026-12-05",
      j1: "2026-11-05",
    });
  });

  it("is idempotent: the layout it leaves is the one asked for, so asking again writes nothing", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 2 },
    ]);

    // The database now holds what was written.
    installmentPlan.findMany.mockResolvedValue([
      planRow({
        incomes: planRow().incomes.map((row) => ({
          ...row,
          date: new Date(
            `${datesWritten()[row.id] ?? row.date.toISOString().slice(0, 10)}T00:00:00.000Z`,
          ),
        })),
      }),
    ]);
    db.$executeRaw.mockClear();

    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 2 },
    ]);

    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("reads the plans of the user only", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_1", count: 0 },
    ]);

    expect(installmentPlan.findMany.mock.calls[0][0].where).toMatchObject({
      userId: USER_ID,
      kind: "INCOME",
    });
  });

  it("ignores a plan that is not among the user's, and a plan repeated", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", [
      { planId: "plan_of_somebody_else", count: 0 },
      { planId: "plan_1", count: 0 },
      { planId: "plan_1", count: 3 },
    ]);

    expect(datesWritten()).toEqual({
      i3: "2026-12-05",
      i4: "2027-01-05",
      i5: "2027-02-05",
    });
  });

  it("does not even read the plans when no count was changed", async () => {
    await applyIncomeInstallmentCounts(USER_ID, "2026-11", []);

    expect(installmentPlan.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
