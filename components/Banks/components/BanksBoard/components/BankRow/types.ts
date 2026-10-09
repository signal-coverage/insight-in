import type { BoardAccount, BoardBank } from "@/core/banks/types";

export interface BankRowProps {
  bank: BoardBank;
  onEditBank: (bankId: string) => void;
  onEditAccount: (account: BoardAccount) => void;
  // Starts a new account in the bank with this id.
  onAddAccount: (bankId: string) => void;
}
