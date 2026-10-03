import type { Source } from "@/components/shared/Await";
import type {
  BoardColumns,
  BoardItem,
  BoardStatus,
} from "@/core/roadmap/types";

// The data is a `Source`: the value itself, or a promise of it while it loads. The page renders its
// header at once and the board waits only for its own piece.
export interface RoadmapProps {
  board: Source<BoardColumns>;
}

// What the form drawer is currently showing: a new card in `status`, or the card being edited. The
// key remounts the form so every opening starts from fresh defaults and cleared errors.
export interface FormTarget {
  key: number;
  status: BoardStatus;
  item: BoardItem | null;
}
