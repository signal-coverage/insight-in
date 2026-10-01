// "Listado" (planned) vs already collected (income) or paid (expense). Shared by incomes and
// expenses; the database enum has the same two values.
export const ENTRY_STATUSES = ["PLANNED", "SETTLED"] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];

// What a manually added entry starts as: the money has already moved.
export const DEFAULT_ENTRY_STATUS: EntryStatus = "SETTLED";

export const isEntryStatus = (value: unknown): value is EntryStatus =>
  typeof value === "string" &&
  (ENTRY_STATUSES as readonly string[]).includes(value);
