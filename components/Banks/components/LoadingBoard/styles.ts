import { COLUMN_FRAME_CLASS_NAME } from "@/components/Banks/styles";

// The sticky column and the account area of a row, at the size and padding of the real ones: the
// column keeps the vertical line, and a card-shaped skeleton sits inside each.
export const CELL_SKELETON_CLASS_NAME = `${COLUMN_FRAME_CLASS_NAME} p-3`;
export const TILES_SKELETON_CLASS_NAME = "flex items-stretch gap-3 p-3";

// A card: 6rem tall, as wide as the real one (the bank card fills its column).
export const BANK_CARD_SKELETON_CLASS_NAME =
  "min-h-24 min-w-0 flex-1 rounded-2xl";
export const TILE_SKELETON_CLASS_NAME = "min-h-24 w-44 shrink-0 rounded-2xl";

// The closing row, standing for "+ Nuevo banco": as wide as the visible board (the board is the
// query container), with the padding of the other rows.
export const ADD_ROW_SKELETON_CLASS_NAME = "flex";
export const ADD_FRAME_SKELETON_CLASS_NAME =
  "sticky left-0 w-[100cqw] shrink-0 p-3";
export const ADD_SKELETON_CLASS_NAME = "min-h-24 w-full rounded-2xl";
