// Test support: imported by tests only, never by production code.
import type { CreditCard, DebitCard } from "./types";

// Builders for the tests: a card as the services return it, and as the database returns it with
// what every read includes (see WITH_CARD_DETAILS). `currency` and `limitAmount` are a shortcut for a
// card with a single cap.

export type CreditCardPatch = Partial<CreditCard> & {
  currency?: string;
  limitAmount?: number;
};

export const creditCard = ({
  currency = "ARS",
  limitAmount = 30000000,
  ...patch
}: CreditCardPatch = {}): CreditCard => ({
  kind: "CREDIT",
  id: "card_1",
  bankId: "bank_1",
  bankName: "Banco Galicia",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  limits: [{ currency, amount: limitAmount }],
  ...patch,
});

export const debitCard = (patch: Partial<DebitCard> = {}): DebitCard => ({
  kind: "DEBIT",
  id: "card_9",
  bankId: "bank_1",
  bankName: "Banco Galicia",
  last4: "9999",
  brand: "VISA",
  accounts: [
    { id: "acc_1", currency: "ARS", label: "Banco Galicia · Caja de ahorro" },
  ],
  ...patch,
});

const AT = new Date("2026-09-01T00:00:00.000Z");

export const creditCardRecord = ({
  currency = "ARS",
  limitAmount = 30000000,
  ...patch
}: Record<string, unknown> & {
  currency?: string;
  limitAmount?: number;
} = {}) => ({
  id: "card_1",
  userId: "user_123",
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  createdAt: AT,
  updatedAt: AT,
  limits: [
    { id: "lim_1", cardId: "card_1", currency, amount: BigInt(limitAmount) },
  ],
  bank: {
    name: "Banco Galicia",
    accounts: [] as { id: string; name: string; currency: string }[],
  },
  ...patch,
});

export const debitCardRecord = (patch: Record<string, unknown> = {}) => ({
  id: "card_9",
  userId: "user_123",
  kind: "DEBIT",
  bankId: "bank_1",
  last4: "9999",
  brand: "VISA",
  closingDay: null,
  dueDay: null,
  limitMode: null,
  createdAt: AT,
  updatedAt: AT,
  limits: [],
  bank: {
    name: "Banco Galicia",
    accounts: [{ id: "acc_1", name: "Caja de ahorro", currency: "ARS" }],
  },
  ...patch,
});
