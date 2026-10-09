import { describe, expect, it } from "vitest";

import { CardBankWithoutAccountError } from "@/core/cards/errors";
import { debitCard } from "@/core/cards/testFixtures";

import { debitAccountOf, needsDebitFundsCheck } from "./debit";
import type { DebitClaim } from "./debit";

const ASTROPAY = debitCard({
  accounts: [
    { id: "acc_ars", currency: "ARS", label: "AstroPay · Pesos" },
    { id: "acc_usd", currency: "USD", label: "AstroPay · Dólares" },
  ],
});

describe("debitAccountOf", () => {
  it("is the bank's active account in the expense's currency for a new expense", () => {
    expect(debitAccountOf(ASTROPAY, "USD", null)).toBe("acc_usd");
  });

  it("refuses a currency the bank has no active account in, naming the currency", () => {
    expect(() => debitAccountOf(ASTROPAY, "EUR", null)).toThrow(
      new CardBankWithoutAccountError("EUR"),
    );
  });

  it("keeps the account the money already left when the edit keeps the card and the currency, even if the bank has none now", () => {
    expect(
      debitAccountOf(debitCard({ accounts: [] }), "ARS", {
        cardId: "card_9",
        currency: "ARS",
        accountId: "acc_archived",
      }),
    ).toBe("acc_archived");
  });

  it("resolves the account again when the edit changes the card or the currency", () => {
    expect(
      debitAccountOf(ASTROPAY, "USD", {
        cardId: "card_9",
        currency: "ARS",
        accountId: "acc_ars",
      }),
    ).toBe("acc_usd");
    expect(
      debitAccountOf(ASTROPAY, "ARS", {
        cardId: "card_other",
        currency: "ARS",
        accountId: "acc_old",
      }),
    ).toBe("acc_ars");
  });
});

describe("needsDebitFundsCheck", () => {
  const PAID: DebitClaim = {
    accountId: "acc_ars",
    amount: 5000,
    date: "2026-10-05",
    status: "SETTLED",
  };

  it("checks a new paid expense, and never a planned or covered one", () => {
    expect(needsDebitFundsCheck(null, PAID)).toBe(true);
    expect(needsDebitFundsCheck(null, { ...PAID, status: "PLANNED" })).toBe(
      false,
    );
    expect(needsDebitFundsCheck(null, { ...PAID, status: "COVERED" })).toBe(
      false,
    );
  });

  it("checks an edit that asks something new of the account: paid now, another account, another day or more money", () => {
    expect(needsDebitFundsCheck({ ...PAID, status: "PLANNED" }, PAID)).toBe(
      true,
    );
    expect(needsDebitFundsCheck({ ...PAID, accountId: "acc_x" }, PAID)).toBe(
      true,
    );
    expect(needsDebitFundsCheck({ ...PAID, date: "2026-10-01" }, PAID)).toBe(
      true,
    );
    expect(needsDebitFundsCheck(PAID, { ...PAID, amount: 5001 })).toBe(true);
  });

  it("does not check an edit that asks nothing more: the same money (the notes), or less of it", () => {
    expect(needsDebitFundsCheck(PAID, PAID)).toBe(false);
    expect(needsDebitFundsCheck(PAID, { ...PAID, amount: 4000 })).toBe(false);
  });
});
