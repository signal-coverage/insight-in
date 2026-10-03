export const ROADMAP_PATH = "/dashboard/roadmap";

// The columns of the board, in the order they are shown. The database enum has the same values.
export const BOARD_STATUSES = ["IDEA", "TODO", "DONE", "DEPLOYED"] as const;

export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 1000;

// The most a card can be asked to move to. Far above what a column will ever hold: it only keeps a
// forged request from asking for something absurd.
export const MAX_COLUMN_INDEX = 10_000;

// The gap left between the positions of two neighbours when a column is numbered from scratch.
export const POSITION_STEP = 1024;

// Below this gap the midpoint of two neighbours is too close to either of them to be trusted, and the
// column is numbered again before the item is placed.
export const MIN_POSITION_GAP = 1e-6;

export const CREATE_FORM_FIELDS = [
  "title",
  "description",
  "status",
  "index",
] as const;
export const UPDATE_FORM_FIELDS = ["title", "description"] as const;

export const ITEM_NOT_FOUND_MESSAGE = "No se encontró la tarjeta.";
export const INVALID_MOVE_MESSAGE = "No se pudo mover la tarjeta.";
