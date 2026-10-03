import type { RecurringChoice } from "@/core/expenses/types";

import type { RecurringRow } from "../../../../types";
import type { Amounts, Choices, RowErrors } from "../../types";

export interface RecurringTableProps {
  // The templates still waiting for a choice, then the ones already decided.
  rows: readonly RecurringRow[];
  choices: Choices;
  amounts: Amounts;
  // Why the last thing done to a row did not work, per template id; shown under the row.
  rowErrors: RowErrors;
  // True while the choices are being applied: nothing can change then.
  isDisabled: boolean;
  onChoiceChange: (id: string, choice: RecurringChoice) => void;
  onAmountChange: (id: string, value: string) => void;
  onEdit: (row: RecurringRow) => void;
  onRemove: (row: RecurringRow) => void;
  onDisable: (row: RecurringRow) => void;
  onRowError: (id: string, message: string | null) => void;
}
