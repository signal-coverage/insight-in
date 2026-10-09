import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  expense: { findMany: vi.fn() },
  income: { findMany: vi.fn() },
}));
const cards = vi.hoisted(() => ({ listCards: vi.fn() }));
const reimbursements = vi.hoisted(() => ({
  listReimbursableExpenses: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/cards/service", () => cards);
vi.mock("@/core/reimbursements/service", () => reimbursements);

import { readAttentionSources } from "./attentionSources";

const USER_ID = "user_123";
const TODAY = "2026-10-08";

const SELECT = {
  id: true,
  description: true,
  amount: true,
  currency: true,
  date: true,
};
const ORDER = [{ date: "asc" }, { id: "asc" }];

beforeEach(() => {
  vi.resetAllMocks();
  db.expense.findMany.mockResolvedValue([]);
  db.income.findMany.mockResolvedValue([]);
  cards.listCards.mockResolvedValue([]);
  reimbursements.listReimbursableExpenses.mockResolvedValue([]);
});

describe("readAttentionSources", () => {
  it("reads the user's planned expenses up to seven days ahead, today included, oldest first", async () => {
    await readAttentionSources(USER_ID, TODAY);

    expect(db.expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: "PLANNED",
        date: { lte: new Date("2026-10-15T00:00:00.000Z") },
      },
      select: SELECT,
      orderBy: ORDER,
    });
  });

  it("reads the user's planned incomes dated before today, not today's", async () => {
    await readAttentionSources(USER_ID, TODAY);

    expect(db.income.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: "PLANNED",
        date: { lt: new Date("2026-10-08T00:00:00.000Z") },
      },
      select: SELECT,
      orderBy: ORDER,
    });
  });

  it("turns amounts into numbers and dates into calendar days", async () => {
    db.expense.findMany.mockResolvedValue([
      {
        id: "e1",
        description: "Luz",
        amount: BigInt(150000),
        currency: "ARS",
        date: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);

    const sources = await readAttentionSources(USER_ID, TODAY);

    expect(sources.plannedExpenses).toEqual([
      {
        id: "e1",
        description: "Luz",
        amount: 150000,
        currency: "ARS",
        date: "2026-10-01",
      },
    ]);
    expect(sources.plannedIncomes).toEqual([]);
  });

  it("reads the user's reimbursements and cards, the cards measured in today's month", async () => {
    const reimbursement = {
      id: "r1",
      description: "Médico",
      date: "2026-09-01",
      currency: "ARS",
      outstanding: 5000,
    };

    reimbursements.listReimbursableExpenses.mockResolvedValue([reimbursement]);

    const sources = await readAttentionSources(USER_ID, TODAY);

    expect(reimbursements.listReimbursableExpenses).toHaveBeenCalledWith(
      USER_ID,
    );
    expect(cards.listCards).toHaveBeenCalledWith(USER_ID, "2026-10");
    expect(sources.reimbursements).toEqual([reimbursement]);
  });

  it("hands the cards on exactly as the cards service returns them, none dropped or changed", async () => {
    const list = [
      { id: "card_1", usage: [] },
      { id: "card_2", usage: [] },
    ];

    cards.listCards.mockResolvedValue(list);

    const sources = await readAttentionSources(USER_ID, TODAY);

    expect(sources.cards).toEqual(list);
    expect(sources.cards).toHaveLength(2);
  });

  it("rejects when a read fails, so the loader can isolate the block", async () => {
    cards.listCards.mockRejectedValue(new Error("database down"));

    await expect(readAttentionSources(USER_ID, TODAY)).rejects.toThrow(
      "database down",
    );
  });
});
