import type { BoardBank } from "@/core/banks/types";

import type { BankRowProps } from "./components/BankRow/types";

// The banks are shown exactly as given: the search and the archived toggle are applied by the
// caller (see core/banks/board.ts).
export interface BanksBoardProps extends Pick<
  BankRowProps,
  "onEditBank" | "onEditAccount" | "onAddAccount"
> {
  banks: readonly BoardBank[];
  // Starts a new bank (the "+ Nuevo banco" row that closes the board).
  onAddBank: () => void;
  // Whether a search is active, which decides what an empty board says.
  isSearching: boolean;
  // Whether any bank is archived. With an empty board and no search, it means every bank is
  // archived and hidden, so the empty message points to the archived toggle.
  hasArchivedBanks: boolean;
}
