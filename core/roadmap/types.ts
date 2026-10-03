import type { BOARD_STATUSES } from "./consts";

// The database enum has the same values.
export type BoardStatus = (typeof BOARD_STATUSES)[number];

// A card of the board. `createdAt` is the calendar day it was created in Argentina ("YYYY-MM-DD"),
// already in the zone the app is used in, so the client never has to convert a moment.
export interface BoardItem {
  id: string;
  title: string;
  description: string | null;
  status: BoardStatus;
  // The order inside its column, ascending.
  position: number;
  createdAt: string;
}

// Every column of the board, each with its cards in order. A column without cards is an empty list.
export type BoardColumns = Record<BoardStatus, BoardItem[]>;

// Validated text of a card.
export interface BoardItemInput {
  title: string;
  description: string | null;
}

// A new card: at the end of its column unless an index says where.
export interface CreateItemInput extends BoardItemInput {
  status: BoardStatus;
  index?: number;
}

// Where a card goes: the column and the place in it, counted among the cards that stay in that
// column (the moving card itself does not count).
export interface MoveItemInput {
  id: string;
  status: BoardStatus;
  index: number;
}

export type RoadmapFieldErrors = Record<string, string[]>;

export type RoadmapActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: RoadmapFieldErrors };
