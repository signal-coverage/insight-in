import { reimbursableRepaidLabel } from "../../consts";
import type { IncomeRow, ReimbursableOption } from "../../types";

// The expenses the form offers: the ones that still expect money, plus the one the income already pays
// back even when nothing is owed on it any more, so editing the income never loses its link.
export const reimbursableChoices = (
  reimbursables: readonly ReimbursableOption[],
  income: IncomeRow | null,
): ReimbursableOption[] => {
  if (
    income === null ||
    income.reimbursesExpenseId === null ||
    reimbursables.some(({ id }) => id === income.reimbursesExpenseId)
  ) {
    return [...reimbursables];
  }

  return [
    {
      id: income.reimbursesExpenseId,
      currency: income.currency,
      label: reimbursableRepaidLabel(income.reimbursesExpenseDescription ?? ""),
    },
    ...reimbursables,
  ];
};
