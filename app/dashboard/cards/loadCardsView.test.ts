import { beforeEach, describe, expect, it, vi } from "vitest";

const pageData = vi.hoisted(() => ({ loadCardsPageData: vi.fn() }));

vi.mock("@/core/cards/pageData", () => pageData);

import type { CardWithUsage } from "@/core/cards/types";

import { loadCardsView } from "./loadCardsView";

const CARD: CardWithUsage = {
  id: "card_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "TOTAL",
  limitAmount: 120000000,
  committedTotal: 30000000,
  monthUsed: 5000000,
  used: 30000000,
  available: 90000000,
  tier: "available",
};

beforeEach(() => {
  pageData.loadCardsPageData.mockReset();
});

describe("loadCardsView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    pageData.loadCardsPageData.mockReturnValue(new Promise(() => {}));

    const view = loadCardsView("user_1");

    expect(Object.keys(view)).toEqual(["table"]);
    expect(view.table).toBeInstanceOf(Promise);
  });

  it("loads the data of the user once", async () => {
    pageData.loadCardsPageData.mockResolvedValue({ cards: [CARD] });

    await loadCardsView("user_1").table;

    expect(pageData.loadCardsPageData).toHaveBeenCalledTimes(1);
    expect(pageData.loadCardsPageData).toHaveBeenCalledWith("user_1");
  });

  it("gives the table its formatted rows", async () => {
    pageData.loadCardsPageData.mockResolvedValue({ cards: [CARD] });

    const { rows } = await loadCardsView("user_1").table;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "card_1",
      title: "Visa •••• 1234",
      percent: 25,
    });
    expect(rows[0].limitLabel).toMatch(/1\.200\.000,00 en total/);
  });

  it("gives no rows for a user without cards", async () => {
    pageData.loadCardsPageData.mockResolvedValue({ cards: [] });

    await expect(loadCardsView("user_1").table).resolves.toEqual({ rows: [] });
  });

  it("rejects the table when the load fails, so it reaches the error boundary", async () => {
    pageData.loadCardsPageData.mockRejectedValue(new Error("database down"));

    await expect(loadCardsView("user_1").table).rejects.toThrow(
      "database down",
    );
  });
});
