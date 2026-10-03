import type { BoardStatus } from "@/core/roadmap/types";

import type { FormTarget } from "./types";

export const PAGE_TITLE = "Hoja de ruta";
export const PAGE_DESCRIPTION =
  "Ideas y tareas de la app, desde que se piensan hasta que están en producción.";

// The button of the header: a new card always starts as an idea.
export const NEW_IDEA_LABEL = "Nueva idea";
export const NEW_IDEA_STATUS: BoardStatus = "IDEA";

// How each column is called, in the board, the menus and the messages.
export const COLUMN_TITLES: Readonly<Record<BoardStatus, string>> = {
  IDEA: "Ideas",
  TODO: "Pendientes",
  DONE: "Hechas",
  DEPLOYED: "En producción",
};

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  status: NEW_IDEA_STATUS,
  item: null,
};
