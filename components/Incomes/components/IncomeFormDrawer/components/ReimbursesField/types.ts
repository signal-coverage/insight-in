import type { ReimbursableOption } from "../../../../types";

export interface ReimbursesFieldProps {
  options: readonly ReimbursableOption[];
  // Only the expenses in this currency are offered: an income never pays back one in another currency.
  currency: string;
  // The id of the expense chosen, or null when the income pays nothing back.
  value: string | null;
  onChange: (expenseId: string | null) => void;
  // What the server said about the choice, shown under the field.
  errorMessage?: string;
}
