export const DELETE_HEADING = "¿Eliminar esta transferencia?";
export const DELETE_WARNING =
  "Se eliminará de forma permanente y el dinero vuelve a la cuenta de origen. Para poder eliminarla, la cuenta de destino tiene que seguir teniendo ese saldo disponible.";
export const CANCEL_LABEL = "Cancelar";
export const CONFIRM_LABEL = "Eliminar";
export const CONFIRM_PENDING_LABEL = "Eliminando…";

// "Galicia · Caja de ahorro a Efectivo · Efectivo ($ 1.500,50)".
export const transferSummary = (
  fromLabel: string,
  toLabel: string,
  amountLabel: string,
): string => `${fromLabel} a ${toLabel} (${amountLabel}).`;
