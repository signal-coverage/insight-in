import { beforeEach, describe, expect, it, vi } from "vitest";

const pageData = vi.hoisted(() => ({ loadCardsPageData: vi.fn() }));

vi.mock("@/core/cards/pageData", () => pageData);

import { creditCard } from "@/core/cards/testFixtures";
import type { CardWithUsage } from "@/core/cards/types";

import { loadCardsView } from "./loadCardsView";

const CARD: CardWithUsage = {
  ...creditCard({ limitMode: "TOTAL", limitAmount: 120000000 }),
  usage: [
    {
      currency: "ARS",
      amount: 120000000,
      committedTotal: 30000000,
      monthUsed: 5000000,
      used: 30000000,
      available: 90000000,
      tier: "available",
    },
  ],
};

beforeEach(() => {
  pageData.loadCardsPageData.mockReset();
});

describe("loadCardsView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    pageData.loadCardsPageData.mockReturnValue(new Promise(() => {}));

    const view = loadCardsView("user_1");

    expect(Object.keys(view)).toEqual(["table", "banks"]);
    expect(view.table).toBeInstanceOf(Promise);
    expect(view.banks).toBeInstanceOf(Promise);
  });

  it("loads the data of the user once", async () => {
    pageData.loadCardsPageData.mockResolvedValue({ cards: [CARD], banks: [] });

    await loadCardsView("user_1").table;

    expect(pageData.loadCardsPageData).toHaveBeenCalledTimes(1);
    expect(pageData.loadCardsPageData).toHaveBeenCalledWith("user_1");
  });

  it("gives the table its formatted rows", async () => {
    pageData.loadCardsPageData.mockResolvedValue({ cards: [CARD], banks: [] });

    const { rows } = await loadCardsView("user_1").table;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "card_1",
      title: "Visa •••• 1234",
      kindLabel: "Crédito",
    });
    expect(rows[0].limits[0].percent).toBe(25);
    expect(rows[0].limits[0].limitLabel).toMatch(/1\.200\.000,00 en total/);
  });

  it("gives no rows for a user without cards", async () => {
    pageData.loadCardsPageData.mockResolvedValue({ cards: [], banks: [] });

    await expect(loadCardsView("user_1").table).resolves.toEqual({ rows: [] });
  });

  it("rejects every section when the load fails, so each reaches the error boundary", async () => {
    pageData.loadCardsPageData.mockRejectedValue(new Error("database down"));

    const view = loadCardsView("user_1");

    await expect(view.table).rejects.toThrow("database down");
    await expect(view.banks).rejects.toThrow("database down");
  });

  it("hands the form the user's active banks as they were read", async () => {
    const banks = [{ id: "bank_1", name: "Banco Galicia" }];

    pageData.loadCardsPageData.mockResolvedValue({ cards: [], banks });

    await expect(loadCardsView("user_1").banks).resolves.toEqual(banks);
  });
});
