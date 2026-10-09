import { Skeleton } from "@heroui/react";

import { BOARD_CLASS_NAME, ROW_CLASS_NAME } from "@/components/Banks/styles";

import { LOADING_LABEL, ROW_PLACEHOLDERS } from "./consts";
import {
  ADD_FRAME_SKELETON_CLASS_NAME,
  ADD_ROW_SKELETON_CLASS_NAME,
  ADD_SKELETON_CLASS_NAME,
  BANK_CARD_SKELETON_CLASS_NAME,
  CELL_SKELETON_CLASS_NAME,
  TILE_SKELETON_CLASS_NAME,
  TILES_SKELETON_CLASS_NAME,
} from "./styles";

// The board while its data is on its way: a few rows shaped like the real ones (cards included), so the page keeps
// its shape and nothing shifts when the real board replaces it.
export function LoadingBoard() {
  return (
    <div
      className={BOARD_CLASS_NAME}
      role="status"
      aria-busy="true"
      aria-label={LOADING_LABEL}
    >
      {ROW_PLACEHOLDERS.map((tiles, row) => (
        <div key={row} className={ROW_CLASS_NAME}>
          <div className={CELL_SKELETON_CLASS_NAME}>
            <Skeleton className={BANK_CARD_SKELETON_CLASS_NAME} />
          </div>
          <div className={TILES_SKELETON_CLASS_NAME}>
            {Array.from({ length: tiles }, (_, tile) => (
              <Skeleton key={tile} className={TILE_SKELETON_CLASS_NAME} />
            ))}
          </div>
        </div>
      ))}
      <div className={ADD_ROW_SKELETON_CLASS_NAME}>
        <div className={ADD_FRAME_SKELETON_CLASS_NAME}>
          <Skeleton className={ADD_SKELETON_CLASS_NAME} />
        </div>
      </div>
    </div>
  );
}
