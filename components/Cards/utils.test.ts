import { describe, expect, it } from "vitest";

import { creditCard, debitCard } from "@/core/cards/testFixtures";
import type { CardLimitUsage, CardWithUsage } from "@/core/cards/types";

import { toCardRows } from "./utils";

const usage = (patch: Partial<CardLimitUsage> = {}): CardLimitUsage => ({
  currency: "ARS",
  amount: 30000000,
  committedTotal: 90000000,
  monthUsed: 7500000,
  used: 7500000,
  available: 22500000,
  tier: "available",
  ...patch,
});

const CREDIT: CardWithUsage = { ...creditCard(), usage: [usage()] };

const rowOf = (card: CardWithUsage = CREDIT) => toCardRows([card])[0];

describe("toCardRows", () => {
  it("keeps the card's own data, so the edit form can start from it", () => {
    expect(rowOf()).toMatchObject({
      id: "card_1",
      kind: "CREDIT",
      bankId: "bank_1",
      bankName: "Banco Galicia",
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      limitMode: "MONTHLY",
    });
  });

  it("writes the brand out next to the last four digits, and the kind in words", () => {
    expect(rowOf().title).toBe("Visa •••• 1234");
    expect(rowOf().brandName).toBe("Visa");
    expect(rowOf().kindLabel).toBe("Crédito");
    expect(
      rowOf({ ...creditCard({ brand: "MASTERCARD" }), usage: [usage()] }).title,
    ).toBe("Mastercard •••• 1234");
  });

  it("writes a card of another brand as 'Otra'", () => {
    expect(
      rowOf({ ...creditCard({ brand: "OTHER" }), usage: [usage()] }).title,
    ).toBe("Otra •••• 1234");
  });

  it("writes the closing and due days of a credit card as 'Día N'", () => {
    expect(rowOf().closingLabel).toBe("Día 25");
    expect(rowOf().dueLabel).toBe("Día 5");
  });

  describe("the caps of a credit card", () => {
    it("is one line per currency, each with its amounts in its own currency", () => {
      const [ars, usd] = rowOf({
        ...creditCard(),
        usage: [
          usage(),
          usage({
            currency: "USD",
            amount: 100000,
            used: 25000,
            available: 75000,
          }),
        ],
      }).limits;

      expect(ars.currency).toBe("ARS");
      expect(ars.limitLabel).toMatch(/^\$\s300\.000,00 por mes$/);
      expect(ars.usedLabel).toMatch(/^\$\s75\.000,00 de \$\s300\.000,00$/);
      expect(usd.currency).toBe("USD");
      expect(usd.limitLabel).toMatch(/^US\$\s1\.000,00 por mes$/);
      expect(usd.usedLabel).toMatch(/^US\$\s250,00 de US\$\s1\.000,00$/);
      expect(usd.percent).toBe(25);
    });

    it("describes a total cap as in total", () => {
      expect(
        rowOf({ ...creditCard({ limitMode: "TOTAL" }), usage: [usage()] })
          .limits[0].limitLabel,
      ).toMatch(/^\$\s300\.000,00 en total$/);
    });

    it("shows an exceeded cap as a negative available amount, with its sign", () => {
      const [line] = rowOf({
        ...creditCard(),
        usage: [
          usage({ used: 35000000, available: -5000000, tier: "exceeded" }),
        ],
      }).limits;

      expect(line.availableLabel).toMatch(/^-\$\s50\.000,00$/);
      expect(line.tier).toBe("exceeded");
      expect(line.percent).toBe(100);
    });

    it("gives each cap as plain text, to prefill the form", () => {
      expect(rowOf().limits[0].limitDecimal).toBe("300000.00");
    });

    it("gives a cap with cents as plain text with its decimals", () => {
      expect(
        rowOf({
          ...creditCard({ currency: "USD", limitAmount: 120050 }),
          usage: [usage({ currency: "USD", amount: 120050 })],
        }).limits[0].limitDecimal,
      ).toBe("1200.50");
    });

    it("is zero percent with nothing used, and rounds the share", () => {
      expect(
        rowOf({ ...creditCard(), usage: [usage({ used: 0 })] }).limits[0]
          .percent,
      ).toBe(0);
      expect(
        rowOf({ ...creditCard(), usage: [usage({ used: 1, amount: 3 })] })
          .limits[0].percent,
      ).toBe(33);
    });

    it("has no currencies line: that is a debit card's", () => {
      expect(rowOf().currenciesLabel).toBeNull();
    });
  });

  describe("a debit or prepaid card", () => {
    const DEBIT: CardWithUsage = {
      ...debitCard({
        bankName: "AstroPay",
        accounts: [
          { id: "a1", currency: "ARS", label: "AstroPay · Pesos" },
          { id: "a2", currency: "USD", label: "AstroPay · Dólares" },
        ],
      }),
      usage: [],
    };

    it("lists the currencies of its bank's active accounts, without amounts, and no caps", () => {
      expect(rowOf(DEBIT)).toMatchObject({
        kind: "DEBIT",
        kindLabel: "Débito o prepago",
        bankName: "AstroPay",
        currenciesLabel: "ARS · USD",
        limits: [],
      });
    });

    it("says so when its bank has no active account", () => {
      expect(
        rowOf({ ...debitCard({ accounts: [] }), usage: [] }).currenciesLabel,
      ).toBe("Sin cuentas activas");
    });

    it("has no cycle: a dash for the days, and no mode", () => {
      expect(rowOf(DEBIT)).toMatchObject({
        closingDay: null,
        dueDay: null,
        limitMode: null,
        closingLabel: "—",
        dueLabel: "—",
      });
    });
  });

  it("keeps the order of the cards", () => {
    const rows = toCardRows([
      { ...creditCard({ id: "a" }), usage: [usage()] },
      { ...debitCard({ id: "b" }), usage: [] },
    ]);

    expect(rows.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});
