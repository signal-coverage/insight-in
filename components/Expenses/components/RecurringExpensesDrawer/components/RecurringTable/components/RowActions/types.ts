import type { RecurringRow } from "../../../../../../types";

export interface RowActionsProps {
  row: RecurringRow;
  // True while something else is being applied: nothing can change then.
  isDisabled: boolean;
  onEdit: (row: RecurringRow) => void;
  onRemove: (row: RecurringRow) => void;
  // Disabling deletes the month's pending expense, so the parent asks for confirmation first.
  onDisable: (row: RecurringRow) => void;
  // Habilitar needs no confirmation and runs here; its outcome goes up as the row's error, or null
  // to clear the one from the last try.
  onError: (id: string, message: string | null) => void;
}
