import type { RecurringChoice } from "@/core/expenses/types";

import type { RecurringRow } from "../../../../types";
import type { Amounts, Choices } from "../../types";

export interface RecurringTableProps {
  // The templates still waiting for a choice, then the ones already decided.
  rows: readonly RecurringRow[];
  choices: Choices;
  amounts: Amounts;
  // True while the choices are being applied: nothing can change then.
  isDisabled: boolean;
  onChoiceChange: (id: string, choice: RecurringChoice) => void;
  onAmountChange: (id: string, value: string) => void;
}
