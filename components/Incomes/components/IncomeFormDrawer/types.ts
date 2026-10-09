import type { AccountChoice } from "@/core/accounts/types";
import type { IncomeCategory } from "@/core/incomes/types";

import type { FormTarget, ReimbursableOption } from "../../types";

export interface IncomeFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  categories: readonly IncomeCategory[];
  // The expenses an income can pay back.
  reimbursables: readonly ReimbursableOption[];
  // Every account of the user, for the "Cuenta" field.
  accounts: readonly AccountChoice[];
}

export type IncomeFormContentProps = Pick<
  IncomeFormDrawerProps,
  "onClose" | "target" | "categories" | "reimbursables" | "accounts"
>;
