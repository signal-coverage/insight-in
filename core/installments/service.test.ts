import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  installmentPlan: { create: vi.fn(), findMany: vi.fn() },
  expense: { createMany: vi.fn() },
  expenseCategory: { findFirst: vi.fn() },
  card: { findFirst: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  CardCurrencyMismatchError,
  CardNotFoundError,
} from "@/core/cards/errors";
import { CategoryNotFoundError } from "@/core/incomes/errors";

import { InstallmentOutOfRangeError } from "./errors";
import {
  createInstallmentPlan,
  listInstallmentPlanRows,
  listInstallmentPlans,
} from "./service";
import type { InstallmentPlanInput } from "./types";

const { expense, expenseCategory, installmentPlan } = db;

const USER_ID = "user_123";

const input: InstallmentPlanInput = {
  description: "Heladera",
  categoryId: "cat_1",
  currency: "ARS",
  medium: "CASH",
  notes: "Garantía 12 meses",
  totalCuotas: 3,
  totalAmount: 100000,
  firstDate: "2026-10-31",
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  expenseCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  installmentPlan.create.mockResolvedValue({ id: "plan_1" });
  expense.createMany.mockResolvedValue({ count: 3 });
});

describe("createInstallmentPlan", () => {
  it("verifies the category belongs to the user before writing anything", async () => {
    await createInstallmentPlan(USER_ID, input);

    expect(expenseCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("writes nothing when the category is not the user's", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(createInstallmentPlan(USER_ID, input)).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(installmentPlan.create).not.toHaveBeenCalled();
    expect(expense.createMany).not.toHaveBeenCalled();
  });

  it("stores the plan for the user, with the day of its first installment", async () => {
    await createInstallmentPlan(USER_ID, input);

    expect(installmentPlan.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        description: "Heladera",
        totalCuotas: 3,
        totalAmount: BigInt(100000),
        currency: "ARS",
        medium: "CASH",
        categoryId: "cat_1",
        notes: "Garantía 12 meses",
        dayOfMonth: 31,
      },
    });
  });

  it("creates every installment as a planned expense linked to the plan, with its number", async () => {
    await createInstallmentPlan(USER_ID, input);

    const common = {
      userId: USER_ID,
      currency: "ARS",
      categoryId: "cat_1",
      notes: "Garantía 12 meses",
      medium: "CASH",
      status: "PLANNED",
      isRecurring: false,
      installmentPlanId: "plan_1",
    };

    expect(expense.createMany).toHaveBeenCalledWith({
      data: [
        {
          ...common,
          description: "Heladera (1/3)",
          amount: BigInt(33334),
          date: new Date("2026-10-31T00:00:00.000Z"),
          installmentNumber: 1,
        },
        {
          ...common,
          description: "Heladera (2/3)",
          amount: BigInt(33333),
          date: new Date("2026-11-30T00:00:00.000Z"),
          installmentNumber: 2,
        },
        {
          ...common,
          description: "Heladera (3/3)",
          amount: BigInt(33333),
          date: new Date("2026-12-31T00:00:00.000Z"),
          installmentNumber: 3,
        },
      ],
    });
  });

  it("makes the installments add up to exactly the total", async () => {
    await createInstallmentPlan(USER_ID, { ...input, totalAmount: 100001 });

    const amounts = expense.createMany.mock.calls[0][0].data.map(
      ({ amount }: { amount: bigint }) => amount,
    );

    expect(
      amounts.reduce((sum: bigint, amount: bigint) => sum + amount, BigInt(0)),
    ).toBe(BigInt(100001));
  });

  it("does the plan and its installments in one transaction", async () => {
    await createInstallmentPlan(USER_ID, input);

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
    expense.createMany.mockRejectedValue(new Error("db down"));

    await expect(createInstallmentPlan(USER_ID, input)).rejects.toThrow(
      "db down",
    );
    expect(rolledBackWith).toBeInstanceOf(Error);
  });

  it("returns the id of the plan", async () => {
    await expect(createInstallmentPlan(USER_ID, input)).resolves.toEqual({
      id: "plan_1",
    });
  });

  describe("with a card and the day of the purchase", () => {
    // The first date the client sends is not the one that counts: the card's cycle decides.
    const withCard = {
      ...input,
      firstDate: "2026-01-01",
      cardId: "card_1",
      purchaseDate: "2026-10-10",
    };

    // Closes on the 25th and is paid on the 5th: a purchase of October 10 is in the statement that
    // closes on October 25, paid on November 5.
    const cardRow = (patch: Record<string, unknown> = {}) => ({
      id: "card_1",
      userId: USER_ID,
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      currency: "ARS",
      limitMode: "MONTHLY",
      limitAmount: BigInt(30000000),
      ...patch,
    });

    beforeEach(() => {
      db.card.findFirst.mockResolvedValue(cardRow());
    });

    it("verifies the card belongs to the user before writing anything", async () => {
      await createInstallmentPlan(USER_ID, withCard);

      expect(db.card.findFirst).toHaveBeenCalledWith({
        where: { id: "card_1", userId: USER_ID },
      });
    });

    it("works the installment dates out from the card's cycle, ignoring the date the client sent", async () => {
      await createInstallmentPlan(USER_ID, withCard);

      expect(
        expense.createMany.mock.calls[0][0].data.map(
          ({ date }: { date: Date }) => date.toISOString().slice(0, 10),
        ),
      ).toEqual(["2026-11-05", "2026-12-05", "2027-01-05"]);
      expect(installmentPlan.create.mock.calls[0][0].data.dayOfMonth).toBe(5);
    });

    it("moves everything one statement on when the purchase is after the closing day", async () => {
      await createInstallmentPlan(USER_ID, {
        ...withCard,
        purchaseDate: "2026-10-26",
      });

      expect(
        expense.createMany.mock.calls[0][0].data[0].date.toISOString(),
      ).toBe("2026-12-05T00:00:00.000Z");
    });

    it("puts the card on every installment, which carries no purchase date of its own", async () => {
      await createInstallmentPlan(USER_ID, withCard);

      const rows = expense.createMany.mock.calls[0][0].data;

      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.cardId).toBe("card_1");
        expect(row).not.toHaveProperty("purchaseDate");
      }
    });

    it("writes nothing when the card is in another currency than the purchase", async () => {
      db.card.findFirst.mockResolvedValue(cardRow({ currency: "USD" }));

      await expect(
        createInstallmentPlan(USER_ID, withCard),
      ).rejects.toBeInstanceOf(CardCurrencyMismatchError);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("writes nothing when the last installment would fall outside the months the app can show", async () => {
      await expect(
        createInstallmentPlan(USER_ID, {
          ...withCard,
          purchaseDate: "2099-11-30",
        }),
      ).rejects.toBeInstanceOf(InstallmentOutOfRangeError);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("writes nothing when the card is not the user's", async () => {
      db.card.findFirst.mockResolvedValue(null);

      await expect(
        createInstallmentPlan(USER_ID, withCard),
      ).rejects.toBeInstanceOf(CardNotFoundError);
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(installmentPlan.create).not.toHaveBeenCalled();
    });

    it("stores the card and the purchase date on the plan", async () => {
      await createInstallmentPlan(USER_ID, withCard);

      expect(installmentPlan.create.mock.calls[0][0].data).toMatchObject({
        cardId: "card_1",
        purchaseDate: new Date("2026-10-10T00:00:00.000Z"),
      });
    });

    it("stores the plan and every installment as digital money, whatever medium came with it: a credit card is never cash", async () => {
      await createInstallmentPlan(USER_ID, { ...withCard, medium: "CASH" });

      expect(installmentPlan.create.mock.calls[0][0].data.medium).toBe(
        "DIGITAL",
      );
      expect(
        expense.createMany.mock.calls[0][0].data.every(
          ({ medium }: { medium: string }) => medium === "DIGITAL",
        ),
      ).toBe(true);
    });

    it("keeps the medium of a purchase with no card of the user's (a borrowed one)", async () => {
      await createInstallmentPlan(USER_ID, { ...input, medium: "CASH" });

      expect(installmentPlan.create.mock.calls[0][0].data.medium).toBe("CASH");
    });

    it("does not look for a card, nor store one, when none is given", async () => {
      await createInstallmentPlan(USER_ID, input);

      expect(db.card.findFirst).not.toHaveBeenCalled();
      expect(installmentPlan.create.mock.calls[0][0].data).not.toHaveProperty(
        "cardId",
      );
      expect(installmentPlan.create.mock.calls[0][0].data).not.toHaveProperty(
        "purchaseDate",
      );
    });
  });

  it("keeps a missing note as null on the plan and on every installment", async () => {
    await createInstallmentPlan(USER_ID, { ...input, notes: null });

    expect(installmentPlan.create.mock.calls[0][0].data.notes).toBeNull();
    expect(
      expense.createMany.mock.calls[0][0].data.every(
        ({ notes }: { notes: string | null }) => notes === null,
      ),
    ).toBe(true);
  });
});

const planRow = (patch: Record<string, unknown> = {}) => ({
  id: "plan_1",
  userId: USER_ID,
  description: "Heladera",
  totalCuotas: 4,
  currency: "ARS",
  dayOfMonth: 5,
  category: { name: "Hogar" },
  expenses: [
    {
      id: "e1",
      installmentNumber: 1,
      date: new Date("2026-09-05T00:00:00.000Z"),
      amount: BigInt(2500),
      status: "SETTLED",
    },
    {
      id: "e2",
      installmentNumber: 2,
      date: new Date("2026-10-05T00:00:00.000Z"),
      amount: BigInt(2500),
      status: "COVERED",
    },
    {
      id: "e3",
      installmentNumber: 3,
      date: new Date("2026-11-05T00:00:00.000Z"),
      amount: BigInt(2501),
      status: "PLANNED",
    },
    {
      id: "e4",
      installmentNumber: 4,
      date: new Date("2026-12-05T00:00:00.000Z"),
      amount: BigInt(2501),
      status: "PLANNED",
    },
  ],
  ...patch,
});

describe("listInstallmentPlanRows", () => {
  it("reads only the user's expense plans: a loan repaid to them is not a purchase to pay", async () => {
    installmentPlan.findMany.mockResolvedValue([]);

    await listInstallmentPlanRows(USER_ID);

    expect(installmentPlan.findMany.mock.calls[0][0].where).toMatchObject({
      userId: USER_ID,
      kind: "EXPENSE",
    });
  });

  it("reads only the user's plans that still have something pending, in installment order", async () => {
    installmentPlan.findMany.mockResolvedValue([]);

    await listInstallmentPlanRows(USER_ID);

    expect(installmentPlan.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        kind: "EXPENSE",
        expenses: { some: { status: "PLANNED" } },
      },
      include: {
        category: { select: { name: true } },
        expenses: {
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

  it("says which card a plan was paid with, and the day of the purchase", async () => {
    installmentPlan.findMany.mockResolvedValue([
      planRow({
        cardId: "card_1",
        purchaseDate: new Date("2026-10-10T00:00:00.000Z"),
      }),
      planRow({ id: "plan_2", cardId: null, purchaseDate: null }),
    ]);

    const [withCard, withoutCard] = await listInstallmentPlanRows(USER_ID);

    expect(withCard).toMatchObject({
      cardId: "card_1",
      purchaseDate: "2026-10-10",
    });
    expect(withoutCard).toMatchObject({ cardId: null, purchaseDate: null });
  });

  it("returns plain objects with the dates as calendar strings", async () => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);

    const [plan] = await listInstallmentPlanRows(USER_ID);

    expect(plan).toMatchObject({
      id: "plan_1",
      description: "Heladera",
      dayOfMonth: 5,
      categoryName: "Hogar",
      currency: "ARS",
      totalCuotas: 4,
    });
    expect(plan.installments[2]).toEqual({
      id: "e3",
      number: 3,
      date: "2026-11-05",
      status: "PLANNED",
      amount: 2501,
    });
  });
});

describe("listInstallmentPlans", () => {
  it("describes each plan for the wizard: done, pending, next amount and the count already in the month", async () => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);

    await expect(listInstallmentPlans(USER_ID, "2026-11")).resolves.toEqual([
      {
        id: "plan_1",
        description: "Heladera",
        categoryName: "Hogar",
        currency: "ARS",
        totalCuotas: 4,
        doneCount: 2,
        pendingCount: 2,
        nextAmount: 2501,
        defaultCount: 1,
      },
    ]);
  });

  it("defaults to none for a month in which no pending installment falls", async () => {
    installmentPlan.findMany.mockResolvedValue([planRow()]);

    const [plan] = await listInstallmentPlans(USER_ID, "2026-08");

    expect(plan.defaultCount).toBe(0);
  });

  it("takes the next amount from the first pending installment by number", async () => {
    installmentPlan.findMany.mockResolvedValue([
      planRow({
        expenses: [
          {
            id: "e4",
            installmentNumber: 4,
            date: new Date("2026-12-05T00:00:00.000Z"),
            amount: BigInt(900),
            status: "PLANNED",
          },
          {
            id: "e3",
            installmentNumber: 3,
            date: new Date("2026-11-05T00:00:00.000Z"),
            amount: BigInt(800),
            status: "PLANNED",
          },
        ],
      }),
    ]);

    const [plan] = await listInstallmentPlans(USER_ID, "2026-11");

    expect(plan.nextAmount).toBe(800);
  });

  it("returns nothing when no plan has a pending installment", async () => {
    installmentPlan.findMany.mockResolvedValue([]);

    await expect(listInstallmentPlans(USER_ID, "2026-11")).resolves.toEqual([]);
  });
});
