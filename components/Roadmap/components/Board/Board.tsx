import { InlineAlert } from "@/components/shared/InlineAlert";
import { BOARD_STATUSES } from "@/core/roadmap/consts";
import type { BoardStatus } from "@/core/roadmap/types";

import { BOARD_GRID_CLASS_NAME, BOARD_ROOT_CLASS_NAME } from "../../styles";
import { BoardColumn } from "./components/BoardColumn";
import type { BoardProps } from "./types";
import { useOptimisticBoard } from "./useOptimisticBoard";

// The four columns. Every way a card moves (a drop, or the menu of the card) goes through `move`,
// which shows the card in its new place at once and saves it in the background; if the save fails
// the card goes back and the reason is shown above the board.
export function Board({ columns, onAdd, onEdit, onDelete }: BoardProps) {
  const { board, error, move } = useOptimisticBoard(columns);

  // The menu of a card always sends it to the end of the column it picks.
  const moveToEnd = (id: string, status: BoardStatus) =>
    move({ id, status, index: board[status].length });

  return (
    <div className={BOARD_ROOT_CLASS_NAME}>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      <div className={BOARD_GRID_CLASS_NAME}>
        {BOARD_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            items={board[status]}
            onMove={move}
            onMoveToEnd={moveToEnd}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
