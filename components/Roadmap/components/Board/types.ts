import type {
  BoardColumns,
  BoardItem,
  BoardStatus,
} from "@/core/roadmap/types";

export interface BoardProps {
  columns: BoardColumns;
  // Asks for a new card in a column (the "+" of each column).
  onAdd: (status: BoardStatus) => void;
  onEdit: (item: BoardItem) => void;
  onDelete: (item: BoardItem) => void;
}
