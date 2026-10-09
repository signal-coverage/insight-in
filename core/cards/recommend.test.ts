import { describe, expect, it } from "vitest";

import { projectionOf, recommendCards } from "./recommend";
import { creditCard, debitCard } from "./testFixtures";
import type { CreditCardPatch } from "./testFixtures";
import type {
  CardCharge,
  CardWithCharges,
  CreditCardWithCharges,
} from "./types";

const card = ({
  charges = [],
  ...patch
}: CreditCardPatch & {
  charges?: CardCharge[];
} = {}): CreditCardWithCharges => ({
  ...creditCard({ limitMode: "TOTAL", limitAmount: 100000, ...patch }),
  charges,
});

// Bought on the 10th: every card below closes after it, so the statement is the one of that month.
const PURCHASE = {
  currency: "ARS",
  totalAmount: 30000,
  totalCuotas: 3,
  purchaseDate: "2026-10-10",
};

describe("projectionOf", () => {
  it("puts the first installment on the due date the card's cycle gives, and one per month after it", () => {
    // Closes the 25th, due the 5th: bought the 10th it is in the October statement, paid November 5.
    expect(projectionOf(card(), PURCHASE)).toEqual({
      currency: "ARS",
      totalAmount: 30000,
      installments: [
        { month: "2026-11", amount: 10000 },
        { month: "2026-12", amount: 10000 },
        { month: "2027-01", amount: 10000 },
      ],
    });
  });

  it("follows the closing day: bought after it, everything moves one month on", () => {
    expect(
      projectionOf(card(), { ...PURCHASE, purchaseDate: "2026-10-26" })
        .installments[0],
    ).toEqual({ month: "2026-12", amount: 10000 });
  });

  it("keeps the installments adding up to the total when it does not divide evenly", () => {
    const { installments } = projectionOf(card(), {
      ...PURCHASE,
      totalAmount: 30001,
    });

    expect(installments.map(({ amount }) => amount)).toEqual([
      10001, 10000, 10000,
    ]);
  });
});

describe("recommendCards", () => {
  it("lists only the cards in the currency of the purchase", () => {
    const result = recommendCards(
      [card(), card({ id: "usd", currency: "USD" })],
      PURCHASE,
    );

    expect(result.map(({ cardId }) => cardId)).toEqual(["card_1"]);
  });

  it("lists nothing when no card is in that currency", () => {
    expect(recommendCards([card({ currency: "USD" })], PURCHASE)).toEqual([]);
  });

  it("never lists a debit card, whatever accounts it has", () => {
    const debit: CardWithCharges = { ...debitCard(), charges: [] };

    expect(
      recommendCards([debit, card()], PURCHASE).map(({ cardId }) => cardId),
    ).toEqual(["card_1"]);
  });

  it("weighs a card with several caps only against the cap of the purchase's currency, never their sum", () => {
    const both = card({
      limits: [
        { currency: "ARS", amount: 37499 },
        { currency: "USD", amount: 1000000 },
      ],
    });

    expect(recommendCards([both], PURCHASE)[0]).toMatchObject({
      verdict: "near",
      margin: 7499,
    });
    expect(
      recommendCards([both], { ...PURCHASE, currency: "USD" })[0],
    ).toMatchObject({ verdict: "fits", margin: 970000 });
  });

  it("leaves out a credit card that has no cap in the purchase's currency", () => {
    expect(
      recommendCards(
        [card({ limits: [{ currency: "USD", amount: 1000000 }] })],
        PURCHASE,
      ),
    ).toEqual([]);
  });

  describe("the verdict", () => {
    it("fits, with what is left of the cap, when the purchase leaves 20% of it or more", () => {
      // 100000 - 30000 = 70000 left, 70% of the cap.
      expect(recommendCards([card()], PURCHASE)[0]).toMatchObject({
        cardId: "card_1",
        verdict: "fits",
        margin: 70000,
      });
    });

    it("is still a fit at exactly 20% of the cap left", () => {
      expect(
        recommendCards([card({ limitAmount: 37500 })], PURCHASE)[0],
      ).toMatchObject({ verdict: "fits", margin: 7500 });
    });

    it("is near the cap when it fits but leaves less than 20% of it", () => {
      expect(
        recommendCards([card({ limitAmount: 37499 })], PURCHASE)[0],
      ).toMatchObject({ verdict: "near", margin: 7499 });
    });

    it("is near the cap when it takes everything that is left", () => {
      expect(
        recommendCards([card({ limitAmount: 30000 })], PURCHASE)[0],
      ).toMatchObject({ verdict: "near", margin: 0 });
    });

    it("exceeds the cap by how much the purchase goes over", () => {
      expect(
        recommendCards([card({ limitAmount: 29999 })], PURCHASE)[0],
      ).toMatchObject({ verdict: "exceeded", excess: 1 });
    });

    it("counts what the card already has: a TOTAL card with 80000 pending has little room", () => {
      const busy = card({
        charges: [
          {
            amount: 80000,
            date: "2026-11-05",
            currency: "ARS",
            status: "PLANNED",
          },
        ],
      });

      expect(recommendCards([busy], PURCHASE)[0]).toMatchObject({
        verdict: "exceeded",
        excess: 10000,
      });
    });

    it("looks at each month the purchase touches on a MONTHLY card, with the charges of that month", () => {
      const monthly = card({
        limitMode: "MONTHLY",
        limitAmount: 12000,
        charges: [
          {
            amount: 3000,
            date: "2026-12-05",
            currency: "ARS",
            status: "SETTLED",
          },
        ],
      });

      // December already has 3000: 3000 + 10000 is 1000 over the 12000 cap.
      expect(recommendCards([monthly], PURCHASE)[0]).toMatchObject({
        verdict: "exceeded",
        excess: 1000,
      });
    });

    it("reports the margin of the tightest month on a MONTHLY card", () => {
      const monthly = card({
        limitMode: "MONTHLY",
        limitAmount: 40000,
        charges: [
          {
            amount: 25000,
            date: "2027-01-05",
            currency: "ARS",
            status: "PLANNED",
          },
        ],
      });

      expect(recommendCards([monthly], PURCHASE)[0]).toMatchObject({
        verdict: "near",
        margin: 5000,
      });
    });

    it("projects the purchase with the cycle of each card", () => {
      const nearNovember = [
        { amount: 1, date: "2026-11-05", currency: "ARS", status: "PLANNED" },
      ] as const;
      const result = recommendCards(
        [
          card({
            limitMode: "MONTHLY",
            limitAmount: 10000,
            charges: [...nearNovember],
          }),
          card({
            id: "late",
            closingDay: 5,
            dueDay: 3,
            limitMode: "MONTHLY",
            limitAmount: 10000,
            charges: [...nearNovember],
          }),
        ],
        PURCHASE,
      );

      // The first card pays its first installment in November, which already has 1. The second
      // closes on the 5th, so the purchase of the 10th goes in the November statement, paid on
      // December 3: November does not get in the way.
      expect(result.find(({ cardId }) => cardId === "card_1")).toMatchObject({
        verdict: "exceeded",
        excess: 1,
      });
      expect(result.find(({ cardId }) => cardId === "late")).toMatchObject({
        verdict: "near",
        margin: 0,
      });
    });
  });

  describe("the recommended card", () => {
    it("is the one that fits with the most room left", () => {
      const result = recommendCards(
        [
          card({ id: "a", limitAmount: 50000 }),
          card({ id: "b", limitAmount: 90000 }),
          card({ id: "c", limitAmount: 70000 }),
        ],
        PURCHASE,
      );

      expect(
        result.filter(({ recommended }) => recommended).map((r) => r.cardId),
      ).toEqual(["b"]);
    });

    it("breaks a tie with the card that closes earlier", () => {
      const result = recommendCards(
        [
          card({ id: "late", closingDay: 28, dueDay: 8 }),
          card({ id: "early", closingDay: 12, dueDay: 22 }),
        ],
        PURCHASE,
      );

      expect(
        result.filter(({ recommended }) => recommended).map((r) => r.cardId),
      ).toEqual(["early"]);
    });

    it("can be a card that is near its cap, if it is the best that fits", () => {
      const result = recommendCards(
        [
          card({ id: "tight", limitAmount: 31000 }),
          card({ id: "over", limitAmount: 20000 }),
        ],
        PURCHASE,
      );

      expect(result.find(({ recommended }) => recommended)).toMatchObject({
        cardId: "tight",
        verdict: "near",
      });
    });

    it("is none when no card fits", () => {
      const result = recommendCards(
        [card({ limitAmount: 10000 }), card({ id: "b", limitAmount: 20000 })],
        PURCHASE,
      );

      expect(result.some(({ recommended }) => recommended)).toBe(false);
    });
  });

  it("lists the cards that fit first, the one with the most room on top, then the ones that do not, the least over first", () => {
    const result = recommendCards(
      [
        card({ id: "far-over", limitAmount: 5000 }),
        card({ id: "small", limitAmount: 40000 }),
        card({ id: "near-over", limitAmount: 29000 }),
        card({ id: "big", limitAmount: 90000 }),
      ],
      PURCHASE,
    );

    expect(result.map(({ cardId }) => cardId)).toEqual([
      "big",
      "small",
      "near-over",
      "far-over",
    ]);
  });
});
