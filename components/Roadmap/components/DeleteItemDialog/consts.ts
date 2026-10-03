// Shown while no card is picked, which only happens while the dialog is closed.
export const DELETE_HEADING_FALLBACK = "¿Eliminar esta tarjeta?";
export const deleteHeading = (title: string): string =>
  `¿Eliminar la tarjeta "${title}"?`;

export const DELETE_WARNING = "Se eliminará de forma permanente.";
export const CANCEL_LABEL = "Cancelar";
export const CONFIRM_LABEL = "Eliminar";
export const CONFIRM_PENDING_LABEL = "Eliminando…";
