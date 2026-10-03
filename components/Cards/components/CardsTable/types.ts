import type { CardRow } from "../../types";

export interface CardsTableProps {
  rows: CardRow[];
  // True while the cards are still on their way: the table shows skeleton rows instead.
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (card: CardRow) => void;
  onDelete: (card: CardRow) => void;
  // The ids of the selected rows. The checkbox column is there once `onSelectionChange` is.
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  // The ids of the rows a delete is working on: dimmed, not selectable and with every control locked
  // until the refreshed rows arrive.
  deletingIds?: ReadonlySet<string>;
}
