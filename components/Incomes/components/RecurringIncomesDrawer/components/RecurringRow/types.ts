import type { RecurringRow } from "../../../../types";

export interface RecurringRowItemProps {
  item: RecurringRow;
  // A failure from an action started outside the row (a refused delete).
  error?: string;
  onEdit: (item: RecurringRow) => void;
  onDelete: (item: RecurringRow) => void;
}
