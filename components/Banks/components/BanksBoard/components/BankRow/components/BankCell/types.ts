import type { Bank } from "@/core/banks/types";

export interface BankCellProps {
  bank: Bank;
  // Opens the editor of the bank.
  onEdit: (bankId: string) => void;
}
