import type { RecurringChoice } from "@/core/expenses/types";

import type { RecurringRow } from "../../../../../../types";

export interface DecisionCellProps {
  row: RecurringRow;
  // The pick made for this row; undefined while nothing is chosen.
  choice: RecurringChoice | undefined;
  isDisabled: boolean;
  onChange: (choice: RecurringChoice) => void;
}
