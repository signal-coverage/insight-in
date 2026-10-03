import { describe, expect, it } from "vitest";

import type { CardWithUsage } from "@/core/cards/types";

import { toCardRows } from "./utils";

const CARD: CardWithUsage = {
  id: "card_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
  committedTotal: 90000000,
  monthUsed: 7500000,
  used: 7500000,
  available: 22500000,
  tier: "available",
};

const rowOf = (patch: Partial<CardWithUsage> = {}) =>
  toCardRows([{ ...CARD, ...patch }])[0];

describe("toCardRows", () => {
  it("keeps the card's own data, so the edit form can start from it", () => {
    expect(rowOf()).toMatchObject({
      id: "card_1",
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      currency: "ARS",
      limitMode: "MONTHLY",
      limitAmount: 30000000,
    });
  });

  it("writes the brand out, next to the last four digits", () => {
    expect(rowOf().title).toBe("Visa •••• 1234");
    expect(rowOf({ brand: "MASTERCARD" }).title).toBe("Mastercard •••• 1234");
    expect(rowOf({ brand: "OTHER" }).title).toBe("Otra •••• 1234");
    expect(rowOf().brandName).toBe("Visa");
  });

  it("writes the closing and due days as 'Día N'", () => {
    expect(rowOf().closingLabel).toBe("Día 25");
    expect(rowOf().dueLabel).toBe("Día 5");
  });

  it("describes a monthly cap as per month", () => {
    expect(rowOf().limitLabel).toMatch(/^\$\s300\.000,00 por mes$/);
  });

  it("describes a total cap as in total", () => {
    expect(rowOf({ limitMode: "TOTAL" }).limitLabel).toMatch(
      /^\$\s300\.000,00 en total$/,
    );
  });

  it("writes what was used against the cap, in the currency of the card", () => {
    expect(rowOf().usedLabel).toMatch(/^\$\s75\.000,00 de \$\s300\.000,00$/);
    expect(rowOf({ currency: "USD" }).usedLabel).toMatch(
      /^US\$\s75\.000,00 de US\$\s300\.000,00$/,
    );
  });

  it("writes the amount still available", () => {
    expect(rowOf().availableLabel).toMatch(/^\$\s225\.000,00$/);
  });

  it("shows an exceeded cap as a negative available amount, with its sign", () => {
    const row = rowOf({
      used: 35000000,
      available: -5000000,
      tier: "exceeded",
    });

    expect(row.availableLabel).toMatch(/^-\$\s50\.000,00$/);
  });

  it("gives the cap as plain text, to prefill the form", () => {
    expect(rowOf().limitDecimal).toBe("300000.00");
    expect(rowOf({ limitAmount: 120050 }).limitDecimal).toBe("1200.50");
  });

  it("carries the tier along", () => {
    expect(rowOf({ tier: "near" }).tier).toBe("near");
  });

  describe("percent", () => {
    it("is the share of the cap that was used, rounded", () => {
      expect(rowOf().percent).toBe(25);
      expect(rowOf({ used: 1, limitAmount: 3 }).percent).toBe(33);
    });

    it("is zero with nothing used", () => {
      expect(rowOf({ used: 0 }).percent).toBe(0);
    });

    it("stops at one hundred when the cap is exceeded", () => {
      expect(rowOf({ used: 60000000 }).percent).toBe(100);
    });
  });

  it("keeps the order of the cards", () => {
    const rows = toCardRows([
      { ...CARD, id: "a" },
      { ...CARD, id: "b" },
    ]);

    expect(rows.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});
