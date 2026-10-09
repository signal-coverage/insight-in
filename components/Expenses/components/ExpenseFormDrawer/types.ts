import type { EntryCategory } from "@/components/Entries/types";
import type { AccountChoice } from "@/core/accounts/types";

import type { CardOption, FormTarget } from "../../types";

export interface ExpenseFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  categories: readonly EntryCategory[];
  // The user's cards, to pay an expense with one of them.
  cards: readonly CardOption[];
  // Every account of the user, for the "Cuenta" field.
  accounts: readonly AccountChoice[];
}

export type ExpenseFormContentProps = Pick<
  ExpenseFormDrawerProps,
  "onClose" | "target" | "categories" | "cards" | "accounts"
>;
