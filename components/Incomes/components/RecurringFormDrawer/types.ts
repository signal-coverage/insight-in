import type { AccountChoice } from "@/core/accounts/types";
import type { IncomeCategory } from "@/core/incomes/types";

import type { RecurringFormTarget } from "../../types";

export interface RecurringFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: RecurringFormTarget;
  categories: readonly IncomeCategory[];
  // Every account of the user, for the "Cuenta" field.
  accounts: readonly AccountChoice[];
}

export type RecurringFormContentProps = Pick<
  RecurringFormDrawerProps,
  "onClose" | "target" | "categories" | "accounts"
>;
