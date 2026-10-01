import { FREQUENCY_LABELS } from "../../consts";

export const FORM_ID = "recurring-income-form";

export const CREATE_HEADING = "Agregar ingreso recurrente";
export const EDIT_HEADING = "Editar ingreso recurrente";
export const CREATE_SUBMIT_LABEL = "Agregar ingreso recurrente";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Agregando ingreso recurrente…";
export const EDIT_PENDING_LABEL = "Guardando…";
export const CANCEL_LABEL = "Cancelar";

export const CREATE_DESCRIPTION =
  "Los ingresos se agregan automáticamente en cada repetición.";
export const EDIT_DESCRIPTION =
  "Los cambios se aplican solo a las próximas repeticiones. Los ingresos ya generados no se modifican.";

export const FREQUENCY_LABEL = "Frecuencia";
export const FREQUENCY_PLACEHOLDER = "Selecciona una frecuencia";
export const START_DATE_LABEL = "Fecha de inicio";
export const START_DATE_HINT =
  "Una fecha pasada agrega las repeticiones omitidas.";
export const END_DATE_LABEL = "Fecha de fin (opcional)";
export const END_DATE_HINT = "Déjala vacía para repetir sin fin.";

export const DEFAULT_FREQUENCY = "MONTHLY";

// The [value, label] pairs the frequency select lists.
export const FREQUENCIES = Object.entries(FREQUENCY_LABELS);
