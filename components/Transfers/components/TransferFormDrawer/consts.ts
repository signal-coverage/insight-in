export const FORM_ID = "transfer-form";

export const CREATE_HEADING = "Crear transferencia";
export const EDIT_HEADING = "Editar transferencia";
export const CREATE_SUBMIT_LABEL = "Crear transferencia";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Creando transferencia…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION =
  "Pasá dinero de una cuenta a otra. No cuenta como ingreso ni como gasto.";
export const EDIT_DESCRIPTION = "Actualizá los datos de esta transferencia.";

export const FROM_LABEL = "Cuenta de origen";
export const TO_LABEL = "Cuenta de destino";
export const FROM_FIELD_NAME = "fromAccountId";
export const TO_FIELD_NAME = "toAccountId";

// Said under the destination when the currency has no other account to receive the money.
export const toEmptyHint = (currency: string): string =>
  `Necesitás otra cuenta en ${currency} para recibir la transferencia.`;
