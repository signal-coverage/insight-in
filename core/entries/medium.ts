// Where an entry's money moves: an account ("digital") or physical cash. The two keep separate
// balances. The database enum has the same two values.
export const PAYMENT_MEDIUMS = ["DIGITAL", "CASH"] as const;

export type PaymentMedium = (typeof PAYMENT_MEDIUMS)[number];

// What an entry starts as unless the user says it was cash.
export const DEFAULT_PAYMENT_MEDIUM: PaymentMedium = "DIGITAL";

export const isPaymentMedium = (value: unknown): value is PaymentMedium =>
  typeof value === "string" &&
  (PAYMENT_MEDIUMS as readonly string[]).includes(value);
