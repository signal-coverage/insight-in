import { describe, expect, it } from "vitest";

import {
  capIn,
  cardCurrencies,
  debitAccountIn,
  isCreditCard,
  isDebitCard,
  limitIn,
} from "./kinds";
import { creditCard, debitCard } from "./testFixtures";

const BOTH = creditCard({
  limits: [
    { currency: "ARS", amount: 30000000 },
    { currency: "USD", amount: 100000 },
  ],
});
const ASTROPAY = debitCard({
  bankName: "AstroPay",
  accounts: [
    { id: "acc_ars", currency: "ARS", label: "AstroPay · Pesos" },
    { id: "acc_usd", currency: "USD", label: "AstroPay · Dólares" },
  ],
});

describe("isCreditCard / isDebitCard", () => {
  it("tells the kinds apart", () => {
    const cards = [BOTH, ASTROPAY];

    expect(cards.filter(isCreditCard).map(({ id }) => id)).toEqual(["card_1"]);
    expect(cards.filter(isDebitCard).map(({ id }) => id)).toEqual(["card_9"]);
  });
});

describe("limitIn and capIn", () => {
  it("find the cap of the currency asked for, never another one", () => {
    expect(limitIn(BOTH, "USD")).toEqual({ currency: "USD", amount: 100000 });
    expect(capIn(BOTH, "USD")).toEqual({
      currency: "USD",
      limitMode: "MONTHLY",
      limitAmount: 100000,
    });
  });

  it("find nothing for a currency the card has no cap in", () => {
    expect(limitIn(BOTH, "EUR")).toBeNull();
    expect(capIn(BOTH, "EUR")).toBeNull();
  });
});

describe("debitAccountIn", () => {
  it("is the account of the bank in that currency", () => {
    expect(debitAccountIn(ASTROPAY, "USD")).toEqual({
      id: "acc_usd",
      currency: "USD",
      label: "AstroPay · Dólares",
    });
  });

  it("is nothing when the bank has no active account in it", () => {
    expect(debitAccountIn(ASTROPAY, "EUR")).toBeNull();
  });
});

describe("cardCurrencies", () => {
  it("is the currencies of a credit card's caps", () => {
    expect(cardCurrencies(BOTH)).toEqual(["ARS", "USD"]);
  });

  it("is the currencies of a debit card's accounts, and none when its bank has no active account", () => {
    expect(cardCurrencies(ASTROPAY)).toEqual(["ARS", "USD"]);
    expect(cardCurrencies(debitCard({ accounts: [] }))).toEqual([]);
  });
});

describe("cards and crypto currencies", () => {
  const WALLET_DEBIT = debitCard({
    bankName: "Mercado Pago",
    accounts: [
      { id: "acc_ars", currency: "ARS", label: "Mercado Pago · Pesos" },
      { id: "acc_usdc", currency: "USDC", label: "Mercado Pago · USDC" },
    ],
  });

  it("lets a wallet's debit card pay in the crypto currency of its accounts", () => {
    expect(cardCurrencies(WALLET_DEBIT)).toEqual(["ARS", "USDC"]);
    expect(debitAccountIn(WALLET_DEBIT, "USDC")?.id).toBe("acc_usdc");
  });

  it("never lets a credit card cover a crypto currency: it has no cap in one", () => {
    expect(limitIn(creditCard(), "ARS")).not.toBeNull();
    expect(limitIn(creditCard(), "USDC")).toBeNull();
  });
});
