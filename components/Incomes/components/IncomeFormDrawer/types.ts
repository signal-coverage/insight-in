import type { IncomeCategory } from "@/core/incomes/types";

import type { FormTarget } from "../../types";

export interface IncomeFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  categories: readonly IncomeCategory[];
}

export type IncomeFormContentProps = Pick<
  IncomeFormDrawerProps,
  "onClose" | "target" | "categories"
>;
