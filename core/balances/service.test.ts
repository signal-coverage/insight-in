import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  openingBalance: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  income: { groupBy: vi.fn() },
  expense: { groupBy: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  getOpeningBalanceEditorData,
  getOpeningBalances,
  saveOpeningBalances,
} from "./service";

const { openingBalance } = db;

const USER_ID = "user_123";

const row = (
  currency: string,
  medium: "DIGITAL" | "CASH",
  amount: number,
  month = "2026-06",
) => ({
  id: `${currency}-${medium}`,
  userId: USER_ID,
  currency,
  medium,
  amount: BigInt(amount),
  month,
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
});

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  openingBalance.findMany.mockResolvedValue([]);
  openingBalance.upsert.mockResolvedValue({});
  openingBalance.deleteMany.mockResolvedValue({ count: 0 });
  db.income.groupBy.mockResolvedValue([]);
  db.expense.groupBy.mockResolvedValue([]);
});

describe("getOpeningBalances", () => {
  it("reads only the user's own rows", async () => {
    await getOpeningBalances(USER_ID);

    expect(openingBalance.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("is null when the user never set one", async () => {
    await expect(getOpeningBalances(USER_ID)).resolves.toBeNull();
  });

  it("gives the shared month and the amounts as plain numbers", async () => {
    openingBalance.findMany.mockResolvedValue([
      row("ARS", "DIGITAL", 5000050),
      row("ARS", "CASH", 800),
      row("USD", "DIGITAL", 12000),
    ]);

    await expect(getOpeningBalances(USER_ID)).resolves.toEqual({
      month: "2026-06",
      amounts: [
        { currency: "ARS", medium: "DIGITAL", amount: 5000050 },
        { currency: "ARS", medium: "CASH", amount: 800 },
        { currency: "USD", medium: "DIGITAL", amount: 12000 },
      ],
    });
  });
});

describe("saveOpeningBalances", () => {
  const input = {
    month: "2026-06",
    amounts: [
      { currency: "ARS", medium: "DIGITAL" as const, amount: 5000 },
      { currency: "ARS", medium: "CASH" as const, amount: 0 },
    ],
  };

  it("upserts each amount for the user, all with the same month", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.upsert).toHaveBeenCalledTimes(2);
    expect(openingBalance.upsert).toHaveBeenCalledWith({
      where: {
        userId_currency_medium: {
          userId: USER_ID,
          currency: "ARS",
          medium: "DIGITAL",
        },
      },
      create: {
        userId: USER_ID,
        currency: "ARS",
        medium: "DIGITAL",
        amount: BigInt(5000),
        month: "2026-06",
      },
      update: { amount: BigInt(5000), month: "2026-06" },
    });
    expect(openingBalance.upsert.mock.calls[1][0].update).toEqual({
      amount: BigInt(0),
      month: "2026-06",
    });
  });

  it("removes the user's other rows, so what was cleared stops counting", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(openingBalance.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        NOT: [
          { currency: "ARS", medium: "DIGITAL" },
          { currency: "ARS", medium: "CASH" },
        ],
      },
    });
  });

  it("removes every row of the user when there is no amount left", async () => {
    await saveOpeningBalances(USER_ID, { month: "2026-06", amounts: [] });

    expect(openingBalance.upsert).not.toHaveBeenCalled();
    expect(openingBalance.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("does it all in one transaction", async () => {
    await saveOpeningBalances(USER_ID, input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("getOpeningBalanceEditorData", () => {
  it("offers the default currency when the user has nothing at all", async () => {
    await expect(getOpeningBalanceEditorData(USER_ID)).resolves.toEqual({
      opening: null,
      currencies: ["ARS"],
    });
  });

  it("offers the currencies the user has entries in, plus the saved ones, plus the default", async () => {
    db.income.groupBy.mockResolvedValue([{ currency: "USD" }]);
    db.expense.groupBy.mockResolvedValue([
      { currency: "EUR" },
      { currency: "USD" },
    ]);
    openingBalance.findMany.mockResolvedValue([row("BRL", "CASH", 100)]);

    const data = await getOpeningBalanceEditorData(USER_ID);

    expect(data.currencies).toEqual(["ARS", "BRL", "EUR", "USD"]);
    expect(data.opening?.month).toBe("2026-06");
  });

  it("only looks at the user's own entries", async () => {
    await getOpeningBalanceEditorData(USER_ID);

    expect(db.income.groupBy.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
    });
    expect(db.expense.groupBy.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
    });
  });
});
