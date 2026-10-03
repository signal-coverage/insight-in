import { Skeleton } from "@heroui/react";

import {
  BOARD_GRID_CLASS_NAME,
  BOARD_ROOT_CLASS_NAME,
  COLUMN_CLASS_NAME,
} from "../../styles";
import { CARD_PLACEHOLDERS, LOADING_LABEL } from "./consts";
import { CARD_SKELETON_CLASS_NAME, HEADER_SKELETON_CLASS_NAME } from "./styles";

// The board while its cards are on their way: the same four columns, each with a few cards' worth of
// skeleton, so the page keeps its shape and nothing shifts when the real board replaces it. It says
// nothing about how many cards there will be.
export function LoadingBoard() {
  return (
    <div className={BOARD_ROOT_CLASS_NAME} aria-busy="true">
      <div
        className={BOARD_GRID_CLASS_NAME}
        role="status"
        aria-label={LOADING_LABEL}
      >
        {CARD_PLACEHOLDERS.map((cards, column) => (
          <div key={column} className={COLUMN_CLASS_NAME}>
            <Skeleton className={HEADER_SKELETON_CLASS_NAME} />
            {Array.from({ length: cards }, (_, card) => (
              <Skeleton key={card} className={CARD_SKELETON_CLASS_NAME} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
