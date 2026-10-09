import type { BoardAccount } from "@/core/banks/types";

export interface AccountTileProps {
  account: BoardAccount;
  // Opens the editor of the account.
  onEdit: (account: BoardAccount) => void;
}
