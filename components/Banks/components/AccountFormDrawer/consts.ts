export const FORM_ID = "account-form";

export const CREATE_HEADING = "Crear cuenta";
export const EDIT_HEADING = "Editar cuenta";
export const CREATE_SUBMIT_LABEL = "Crear cuenta";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Creando cuenta…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION =
  "Una cuenta guarda dinero en una sola moneda y pertenece a un banco.";
export const EDIT_DESCRIPTION =
  "Actualizá el nombre o la moneda de esta cuenta.";

export const BANK_FIELD_NAME = "bankId";
export const BANK_LABEL = "Banco";
export const BANK_PLACEHOLDER = "Seleccioná un banco";
export const NO_BANKS_HINT =
  "Primero creá un banco para poder agregarle cuentas.";

export const NAME_FIELD_NAME = "name";
export const NAME_LABEL = "Nombre";
export const NAME_PLACEHOLDER = "Ej.: Caja de ahorro";

export const CURRENCY_FIELD_NAME = "currency";
export const CURRENCY_LOCKED_HINT =
  "La moneda no se puede cambiar porque la cuenta ya tiene movimientos.";

export const ARCHIVE_SECTION_LABEL = "Archivo";
export const ARCHIVE_LABEL = "Archivar cuenta";
export const ARCHIVE_PENDING_LABEL = "Archivando…";
export const UNARCHIVE_LABEL = "Reactivar cuenta";
export const UNARCHIVE_PENDING_LABEL = "Reactivando…";

export const accountArchiveHint = (isArchived: boolean): string =>
  isArchived
    ? "Esta cuenta está archivada: no aparece en el tablero salvo que muestres los archivados. Reactivala para volver a usarla."
    : "Solo podés archivar una cuenta en cero, sin movimientos pendientes ni recurrentes. No se borra nada y podés reactivarla cuando quieras.";

export const DELETE_SECTION_LABEL = "Eliminación";
export const DELETE_LABEL = "Eliminar cuenta";
export const DELETE_WARNING = "Se elimina de forma permanente.";

export const deleteHeading = (accountName: string): string =>
  `¿Eliminar la cuenta ${accountName}?`;

// Deleting is only for an account that never had a movement; with history it is archived instead.
export const accountDeleteHint = (hasMovements: boolean): string =>
  hasMovements
    ? "Esta cuenta ya tiene movimientos, así que no se puede eliminar. Archivala en su lugar."
    : "Eliminar borra la cuenta para siempre. Solo podés eliminarla si nunca tuvo movimientos.";
