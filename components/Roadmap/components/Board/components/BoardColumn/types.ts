import type {
  BoardItem,
  BoardStatus,
  MoveItemInput,
} from "@/core/roadmap/types";

export interface BoardColumnProps {
  status: BoardStatus;
  // The cards of the column, in order.
  items: readonly BoardItem[];
  // Asks for a card to go to a place of a column (a drop).
  onMove: (move: MoveItemInput) => void;
  // Asks for a card to go to the end of a column (the "Mover a…" menu of a card).
  onMoveToEnd: (id: string, status: BoardStatus) => void;
  // Asks for a new card in this column.
  onAdd: (status: BoardStatus) => void;
  onEdit: (item: BoardItem) => void;
  onDelete: (item: BoardItem) => void;
}

export type ColumnDragAndDropOptions = Pick<
  BoardColumnProps,
  "status" | "items" | "onMove"
>;
