import type { BoardStatus } from "@/core/roadmap/types";

export interface MoveMenuProps {
  // The title of the card, for the accessible name of the button.
  title: string;
  // The column the card is in: the one the menu does not offer.
  status: BoardStatus;
  onMove: (status: BoardStatus) => void;
}
