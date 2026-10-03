// "Listado" (planned) vs already collected (income) or paid (expense), plus "Cubierta" (covered):
// someone else paid that installment of a purchase in cuotas. The database enum has the same
// three values.
export const ENTRY_STATUSES = ["PLANNED", "SETTLED", "COVERED"] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

// The statuses of an entry that moves the user's money: incomes always, and expenses outside an
// installment plan. COVERED is left out because it never moves money.
export const MONEY_STATUSES = ["PLANNED", "SETTLED"] as const;

export type MoneyStatus = (typeof MONEY_STATUSES)[number];

// What a manually added entry starts as: the money has already moved.
export const DEFAULT_ENTRY_STATUS: MoneyStatus = "SETTLED";

export const isEntryStatus = (value: unknown): value is EntryStatus =>
  typeof value === "string" &&
  (ENTRY_STATUSES as readonly string[]).includes(value);

export const isMoneyStatus = (value: unknown): value is MoneyStatus =>
  typeof value === "string" &&
  (MONEY_STATUSES as readonly string[]).includes(value);
