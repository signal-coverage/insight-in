import { useOptimistic, useState, useTransition } from "react";

import { moveItemAction } from "@/core/roadmap/actions";
import { moveInColumns } from "@/core/roadmap/board";
import { GENERIC_ERROR_MESSAGE } from "@/core/incomes/consts";
import type {
  BoardColumns,
  MoveItemInput,
  RoadmapActionResult,
} from "@/core/roadmap/types";

// The board with a card dropped, answering at once, before the server has saved anything.
//
// The move lives in React's optimistic state, which stays for as long as the transition that saves
// it, and that includes the refresh the save causes: the real columns are swapped in only when the
// transition commits with them, so the card never flickers back to where it was in between. If the
// save fails, the transition ends with the saved columns unchanged, so the card goes back by itself,
// and the reason is kept for the caller to show.
export const useOptimisticBoard = (saved: BoardColumns) => {
  const [board, applyMove] = useOptimistic<BoardColumns, MoveItemInput>(
    saved,
    moveInColumns,
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const move = (request: MoveItemInput) => {
    startTransition(async () => {
      setError(null);
      applyMove(request);

      let result: RoadmapActionResult;

      try {
        result = await moveItemAction(request);
      } catch {
        result = { status: "error", message: GENERIC_ERROR_MESSAGE };
      }

      if (result.status === "error") {
        // After an await the update is no longer part of the transition unless it is wrapped again:
        // it must land together with the card going back.
        startTransition(() => setError(result.message));
      }
    });
  };

  return { board, error, move };
};
