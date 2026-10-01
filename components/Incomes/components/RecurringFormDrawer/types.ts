import type { IncomeCategory } from "@/core/incomes/types";

import type { RecurringFormTarget } from "../../types";

export interface RecurringFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: RecurringFormTarget;
  categories: readonly IncomeCategory[];
}

export type RecurringFormContentProps = Pick<
  RecurringFormDrawerProps,
  "onClose" | "target" | "categories"
>;
