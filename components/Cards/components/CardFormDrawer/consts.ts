import type { CardBrand, CardLimitMode } from "@/core/cards/types";

export const FORM_ID = "card-form";

export const CREATE_HEADING = "Agregar tarjeta";
export const EDIT_HEADING = "Editar tarjeta";
export const CREATE_SUBMIT_LABEL = "Agregar tarjeta";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Agregando tarjeta…";
export const EDIT_PENDING_LABEL = "Guardando…";

// Nothing sensitive is ever asked for, and the form says so.
export const CREATE_DESCRIPTION =
  "Guardá solo una referencia: no pedimos el número completo ni el código de seguridad.";
export const EDIT_DESCRIPTION = "Actualizá los datos de esta tarjeta.";

export const CLOSING_DAY_FIELD_NAME = "closingDay";
export const CLOSING_DAY_LABEL = "Día de cierre";
export const CLOSING_DAY_HINT = "El día del mes en que cierra el resumen";

export const DUE_DAY_FIELD_NAME = "dueDay";
export const DUE_DAY_LABEL = "Día de vencimiento";
export const DUE_DAY_HINT = "El día del mes en que se paga el resumen";

export const LIMIT_AMOUNT_FIELD_NAME = "limitAmount";
export const LIMIT_AMOUNT_LABEL = "Monto del tope";
export const LIMIT_AMOUNT_HINT =
  "Puede ser el límite real de la tarjeta o uno menor que quieras respetar.";

// What a new card starts as.
export const DEFAULT_BRAND: CardBrand = "VISA";
export const DEFAULT_CLOSING_DAY = 1;
export const DEFAULT_DUE_DAY = 15;
export const DEFAULT_LIMIT_MODE: CardLimitMode = "MONTHLY";
