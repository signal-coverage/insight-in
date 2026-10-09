export const FORM_ID = "bank-form";

export const CREATE_HEADING = "Crear banco";
export const EDIT_HEADING = "Editar banco";
export const CREATE_SUBMIT_LABEL = "Crear banco";
export const EDIT_SUBMIT_LABEL = "Guardar cambios";
// What the submit button says while the save is in flight.
export const CREATE_PENDING_LABEL = "Creando banco…";
export const EDIT_PENDING_LABEL = "Guardando…";

export const CREATE_DESCRIPTION =
  "Un banco agrupa tus cuentas: una cuenta bancaria, una billetera virtual o el efectivo.";
export const EDIT_DESCRIPTION = "Actualizá el nombre o el tipo de este banco.";

export const NAME_FIELD_NAME = "name";
export const NAME_LABEL = "Nombre";
export const NAME_PLACEHOLDER = "Ej.: Banco Galicia";

export const ARCHIVE_SECTION_LABEL = "Archivo";
export const ARCHIVE_LABEL = "Archivar banco";
export const ARCHIVE_PENDING_LABEL = "Archivando…";
export const UNARCHIVE_LABEL = "Reactivar banco";
export const UNARCHIVE_PENDING_LABEL = "Reactivando…";

// What the archive section says: a bank is archived only when all its accounts are.
export const bankArchiveHint = (
  isArchived: boolean,
  activeAccounts: number,
): string => {
  if (isArchived) {
    return "Este banco está archivado: no aparece en el tablero salvo que muestres los archivados. Reactivalo para volver a usarlo.";
  }

  if (activeAccounts > 0) {
    return "Para archivar este banco, archivá primero todas sus cuentas.";
  }

  return "Archivar oculta el banco del tablero. No se borra nada y podés reactivarlo cuando quieras.";
};

export const DELETE_SECTION_LABEL = "Eliminación";
export const DELETE_LABEL = "Eliminar banco";
export const DELETE_HINT =
  "Eliminar borra el banco para siempre. Solo podés eliminarlo si no tiene cuentas (archivadas incluidas) ni tarjetas.";
export const DELETE_WARNING =
  "Se elimina de forma permanente. Solo se puede eliminar si no tiene cuentas (archivadas incluidas) ni tarjetas.";

export const deleteHeading = (bankName: string): string =>
  `¿Eliminar el banco ${bankName}?`;
