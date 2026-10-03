export const FORM_ID = "expense-form";

export const CREATE_HEADING = "Agregar gasto";
export const EDIT_HEADING = "Editar gasto";
export const CREATE_SUBMIT_LABEL = "Agregar gasto";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Agregando gasto…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION = "Registra el dinero que gastaste.";
export const EDIT_DESCRIPTION = "Actualiza los datos de este gasto.";

export const DESCRIPTION_PLACEHOLDER = "p. ej. Alquiler de septiembre";

// Under the purchase date of an expense paid with a card: when the card charges it, and which
// statement it goes in. Both dates are already formatted.
export const chargeLine = (chargeDate: string, closingDate: string): string =>
  `Se cobra el ${chargeDate} (resumen que cierra el ${closingDate})`;
