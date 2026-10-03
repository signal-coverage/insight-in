import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  card: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  expense: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  CardHasPendingExpensesError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import {
  createCard,
  deleteCard,
  findOwnedCard,
  listCards,
  listCardsWithCharges,
  updateCard,
} from "./service";
import type { CardInput } from "./types";

const { card, expense } = db;

const USER_ID = "user_123";

const input: CardInput = {
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
};

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
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...patch,
});

// An expense charged to a card: an installment of a plan or a purchase in one payment.
const installmentRow = (patch: Record<string, unknown> = {}) => ({
  amount: BigInt(1000000),
  date: new Date("2026-10-05T00:00:00.000Z"),
  currency: "ARS",
  status: "PLANNED",
  cardId: "card_1",
  ...patch,
});

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listCards", () => {
  beforeEach(() => {
    card.findMany.mockResolvedValue([cardRow()]);
    expense.findMany.mockResolvedValue([]);
  });

  it("reads only the user's cards, in the order they were added", async () => {
    await listCards(USER_ID, "2026-10");

    expect(card.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("reads the user's pending and paid expenses that have a card, in one query for every card", async () => {
    await listCards(USER_ID, "2026-10");

    expect(expense.findMany).toHaveBeenCalledTimes(1);
    expect(expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        cardId: { not: null },
        status: { in: ["PLANNED", "SETTLED"] },
      },
      select: {
        amount: true,
        date: true,
        currency: true,
        status: true,
        cardId: true,
      },
    });
  });

  it("counts an expense quoted in another currency by what really left the money: the reference price is never read", async () => {
    // A 20 USD purchase that cost 35.000 ARS on the card: only the 35.000 weighs on the cap.
    expense.findMany.mockResolvedValue([
      installmentRow({
        amount: BigInt(3500000),
        originCurrency: "USD",
        originAmount: BigInt(2000),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.monthUsed).toBe(3500000);
    expect(first.committedTotal).toBe(3500000);
    expect(
      Object.keys(expense.findMany.mock.calls[0][0].select).filter((key) =>
        key.startsWith("origin"),
      ),
    ).toEqual([]);
  });

  it("returns plain cards with the cap as a number", async () => {
    const [first] = await listCards(USER_ID, "2026-10");

    expect(first).toMatchObject({
      id: "card_1",
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      currency: "ARS",
      limitMode: "MONTHLY",
      limitAmount: 30000000,
    });
    expect(first).not.toHaveProperty("userId");
  });

  it("measures a MONTHLY card by what falls in the month asked for", async () => {
    expense.findMany.mockResolvedValue([
      installmentRow({
        amount: BigInt(1000000),
        date: new Date("2026-10-05T00:00:00.000Z"),
      }),
      installmentRow({
        amount: BigInt(2500000),
        date: new Date("2026-10-28T00:00:00.000Z"),
      }),
      installmentRow({
        amount: BigInt(4000000),
        date: new Date("2026-11-05T00:00:00.000Z"),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first).toMatchObject({
      committedTotal: 7500000,
      monthUsed: 3500000,
      used: 3500000,
      available: 26500000,
      tier: "available",
    });
  });

  it("measures a TOTAL card by everything it has committed", async () => {
    card.findMany.mockResolvedValue([
      cardRow({ limitMode: "TOTAL", limitAmount: BigInt(10000000) }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(1000000) }),
      installmentRow({
        amount: BigInt(8500000),
        date: new Date("2027-02-05T00:00:00.000Z"),
      }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first).toMatchObject({
      used: 9500000,
      available: 500000,
      tier: "near",
    });
  });

  it("gives each card only the expenses charged to it", async () => {
    card.findMany.mockResolvedValue([
      cardRow(),
      cardRow({ id: "card_2", last4: "9999", limitMode: "TOTAL" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
      installmentRow({ amount: BigInt(200), cardId: "card_2" }),
      installmentRow({ amount: BigInt(400), cardId: "card_2" }),
      installmentRow({ amount: BigInt(800), cardId: "someone_elses" }),
    ]);

    const [first, second] = await listCards(USER_ID, "2026-10");

    expect(first.committedTotal).toBe(100);
    expect(second.committedTotal).toBe(600);
  });

  it("counts a MONTHLY card's paid expenses of the month, but not a TOTAL card's", async () => {
    card.findMany.mockResolvedValue([
      cardRow(),
      cardRow({ id: "card_2", last4: "9999", limitMode: "TOTAL" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(300), status: "SETTLED" }),
      installmentRow({ amount: BigInt(100) }),
      installmentRow({
        amount: BigInt(300),
        status: "SETTLED",
        cardId: "card_2",
      }),
      installmentRow({ amount: BigInt(100), cardId: "card_2" }),
    ]);

    const [monthly, total] = await listCards(USER_ID, "2026-10");

    expect(monthly).toMatchObject({ used: 400, committedTotal: 100 });
    expect(total).toMatchObject({ used: 100, committedTotal: 100 });
  });

  it("does not count installments in another currency than the card's", async () => {
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100), currency: "USD" }),
    ]);

    const [first] = await listCards(USER_ID, "2026-10");

    expect(first.committedTotal).toBe(0);
  });

  it("returns no cards for a user who has none", async () => {
    card.findMany.mockResolvedValue([]);

    await expect(listCards(USER_ID, "2026-10")).resolves.toEqual([]);
  });

  it("defaults to the current month in Argentina", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
    ]);

    try {
      const [first] = await listCards(USER_ID);

      expect(first.monthUsed).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createCard", () => {
  beforeEach(() => {
    card.create.mockResolvedValue(cardRow());
  });

  it("stores the card for the user, with the cap as a BigInt", async () => {
    await createCard(USER_ID, input);

    expect(card.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        last4: "1234",
        brand: "VISA",
        closingDay: 25,
        dueDay: 5,
        currency: "ARS",
        limitMode: "MONTHLY",
        limitAmount: BigInt(30000000),
      },
    });
  });

  it("returns the card it stored", async () => {
    await expect(createCard(USER_ID, input)).resolves.toMatchObject({
      id: "card_1",
      limitAmount: 30000000,
    });
  });

  it("says so when the user already has that brand ending in those digits", async () => {
    card.create.mockRejectedValue(uniqueViolation());

    await expect(createCard(USER_ID, input)).rejects.toEqual(
      new DuplicateCardError("VISA", "1234"),
    );
  });

  it("lets any other failure through", async () => {
    card.create.mockRejectedValue(new Error("db down"));

    await expect(createCard(USER_ID, input)).rejects.toThrow("db down");
  });
});

describe("updateCard", () => {
  beforeEach(() => {
    card.updateMany.mockResolvedValue({ count: 1 });
  });

  it("changes the card only when it belongs to the user, and never its owner", async () => {
    await updateCard(USER_ID, "card_1", input);

    expect(card.updateMany).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      data: {
        last4: "1234",
        brand: "VISA",
        closingDay: 25,
        dueDay: 5,
        currency: "ARS",
        limitMode: "MONTHLY",
        limitAmount: BigInt(30000000),
      },
    });
  });

  it("can switch the mode of the cap", async () => {
    await updateCard(USER_ID, "card_1", { ...input, limitMode: "TOTAL" });

    expect(card.updateMany.mock.calls[0][0].data.limitMode).toBe("TOTAL");
  });

  it("is not found when the card is not the user's", async () => {
    card.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateCard(USER_ID, "card_9", input)).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
  });

  it("says so when it would clash with another card of the user", async () => {
    card.updateMany.mockRejectedValue(uniqueViolation());

    await expect(updateCard(USER_ID, "card_1", input)).rejects.toEqual(
      new DuplicateCardError("VISA", "1234"),
    );
  });

  it("lets any other failure through", async () => {
    card.updateMany.mockRejectedValue(new Error("db down"));

    await expect(updateCard(USER_ID, "card_1", input)).rejects.toThrow(
      "db down",
    );
  });
});

describe("deleteCard", () => {
  beforeEach(() => {
    card.findFirst.mockResolvedValue({ id: "card_1" });
    expense.count.mockResolvedValue(0);
    card.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("looks for the card among the user's own", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("is not found, and deletes nothing, when the card is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(deleteCard(USER_ID, "card_9")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
    expect(card.deleteMany).not.toHaveBeenCalled();
  });

  it("asks whether any expense charged to the card is still to pay", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(expense.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "PLANNED", cardId: "card_1" },
    });
  });

  it("is blocked while an expense charged to the card is still pending", async () => {
    expense.count.mockResolvedValue(3);

    await expect(deleteCard(USER_ID, "card_1")).rejects.toBeInstanceOf(
      CardHasPendingExpensesError,
    );
    expect(card.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes the card once nothing is pending, for the user only", async () => {
    await deleteCard(USER_ID, "card_1");

    expect(card.deleteMany).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
    });
  });

  it("is not found when the card disappears before it is deleted", async () => {
    card.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCard(USER_ID, "card_1")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
  });
});

describe("findOwnedCard", () => {
  it("returns the card when it is the user's, as a plain card", async () => {
    card.findFirst.mockResolvedValue(cardRow());

    const found = await findOwnedCard(USER_ID, "card_1");

    expect(card.findFirst).toHaveBeenCalledWith({
      where: { id: "card_1", userId: USER_ID },
    });
    expect(found).toMatchObject({
      id: "card_1",
      closingDay: 25,
      dueDay: 5,
      currency: "ARS",
    });
    expect(found).not.toHaveProperty("userId");
  });

  it("throws for a card that is not the user's", async () => {
    card.findFirst.mockResolvedValue(null);

    await expect(findOwnedCard(USER_ID, "card_9")).rejects.toBeInstanceOf(
      CardNotFoundError,
    );
  });
});

describe("listCardsWithCharges", () => {
  it("gives each of the user's cards the charges that were made with it, for the planner to project a purchase", async () => {
    card.findMany.mockResolvedValue([
      cardRow(),
      cardRow({ id: "card_2", last4: "9999" }),
    ]);
    expense.findMany.mockResolvedValue([
      installmentRow({ amount: BigInt(100) }),
      installmentRow({
        amount: BigInt(300),
        status: "SETTLED",
        date: new Date("2026-11-05T00:00:00.000Z"),
      }),
    ]);

    const [first, second] = await listCardsWithCharges(USER_ID);

    expect(first.charges).toEqual([
      { amount: 100, date: "2026-10-05", currency: "ARS", status: "PLANNED" },
      { amount: 300, date: "2026-11-05", currency: "ARS", status: "SETTLED" },
    ]);
    expect(second.charges).toEqual([]);
    expect(first).toMatchObject({ id: "card_1", closingDay: 25, dueDay: 5 });
    expect(first).not.toHaveProperty("userId");
  });
});
