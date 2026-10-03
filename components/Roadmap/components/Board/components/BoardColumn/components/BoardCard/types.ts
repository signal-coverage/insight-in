import type { BoardItem, BoardStatus } from "@/core/roadmap/types";

export interface BoardCardProps {
  item: BoardItem;
  // Moves the card to the end of another column (the "Mover a…" menu).
  onMove: (id: string, status: BoardStatus) => void;
  onEdit: (item: BoardItem) => void;
  onDelete: (item: BoardItem) => void;
}
