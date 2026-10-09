import type { EntryStatus } from "@/core/entries/status";

export interface ExpenseStatusFieldProps {
  // The status selected when the form opens: the one the expense has now, or the default of a new one.
  defaultStatus: EntryStatus;
  // Called with the status the user picks.
  onChange?: (status: EntryStatus) => void;
}

export interface ExpenseStatusOption {
  value: EntryStatus;
  label: string;
}
