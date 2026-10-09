import type { BankChoice } from "@/core/banks/types";

export interface BankFieldProps {
  // The user's active banks, in the order of the Banks board.
  banks: readonly BankChoice[];
}
