import type { Source } from "@/components/shared/Await";
import type {
  BankWithAccounts,
  BoardAccount,
  BoardBank,
} from "@/core/banks/types";

// The data is a `Source`: the value itself, or a promise of it while it loads. The page renders its
// header and toolbar at once and the board waits only for its own piece.
export interface BanksProps {
  board: Source<readonly BoardBank[]>;
}

// What the bank drawer is currently showing: a new bank, or the bank being edited (with its
// accounts, which decide whether it can be archived). The key remounts the form so every opening
// starts from fresh defaults and cleared errors.
export interface BankFormTarget {
  key: number;
  bank: BankWithAccounts | null;
}

// What the account drawer is currently showing: a new account (in `bankId` when the "+ Nueva cuenta" card
// of a bank was pressed, in no bank yet when it came from the Actions menu), or the account being
// edited.
export interface AccountFormTarget {
  key: number;
  account: BoardAccount | null;
  bankId: string | null;
}
