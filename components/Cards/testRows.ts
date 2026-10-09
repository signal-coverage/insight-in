// Test support: imported by tests only, never by production code.
import type { CardLimitRow, CardRow } from "./types";

// Builders for the tests of the Cards page: rows as toCardRows formats them.

export const limitRow = (patch: Partial<CardLimitRow> = {}): CardLimitRow => ({
  currency: "ARS",
  limitLabel: "$ 300.000,00 por mes",
  usedLabel: "$ 75.000,00 de $ 300.000,00",
  availableLabel: "$ 225.000,00",
  limitDecimal: "300000.00",
  percent: 25,
  tier: "available",
  ...patch,
});

export const creditCardRow = (patch: Partial<CardRow> = {}): CardRow => ({
  id: "card_1",
  kind: "CREDIT",
  bankId: "bank_1",
  bankName: "Banco Galicia",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  limitMode: "MONTHLY",
  title: "Visa •••• 1234",
  brandName: "Visa",
  kindLabel: "Crédito",
  closingLabel: "Día 25",
  dueLabel: "Día 5",
  limits: [limitRow()],
  currenciesLabel: null,
  ...patch,
});

export const debitCardRow = (patch: Partial<CardRow> = {}): CardRow => ({
  id: "card_9",
  kind: "DEBIT",
  bankId: "bank_2",
  bankName: "AstroPay",
  last4: "9999",
  brand: "MASTERCARD",
  closingDay: null,
  dueDay: null,
  limitMode: null,
  title: "Mastercard •••• 9999",
  brandName: "Mastercard",
  kindLabel: "Débito o prepago",
  closingLabel: "—",
  dueLabel: "—",
  limits: [],
  currenciesLabel: "ARS · USD",
  ...patch,
});
