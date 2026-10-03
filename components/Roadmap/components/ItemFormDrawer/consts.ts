import type { BoardStatus } from "@/core/roadmap/types";

import { COLUMN_TITLES } from "../../consts";

export const FORM_ID = "roadmap-item-form";

export const TITLE_FIELD_NAME = "title";
export const DESCRIPTION_FIELD_NAME = "description";
export const STATUS_FIELD_NAME = "status";

export const TITLE_LABEL = "Título";
export const TITLE_PLACEHOLDER = "Ej.: Exportar los gastos a Excel";
export const DESCRIPTION_LABEL = "Descripción (opcional)";
export const DESCRIPTION_PLACEHOLDER = "Sumá el detalle que quieras recordar";

export const CREATE_HEADING = "Nueva tarjeta";
export const createDescription = (status: BoardStatus): string =>
  `Se agrega a ${COLUMN_TITLES[status]}.`;
export const EDIT_HEADING = "Editar tarjeta";
export const EDIT_DESCRIPTION =
  "Actualizá el título o la descripción de la tarjeta.";

export const CREATE_SUBMIT_LABEL = "Agregar tarjeta";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Agregando…";
export const EDIT_PENDING_LABEL = "Guardando…";
