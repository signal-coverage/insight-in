// The summary shows the opening balance, so saving it refreshes this page (and the Banks one).
export const OVERVIEW_PATH = "/dashboard/overview";

// More rows than any user has accounts: a forged payload cannot ask for more writes than that.
export const MAX_OPENING_ACCOUNTS = 200;

export const INVALID_MONTH_MESSAGE = "Selecciona un mes válido.";
export const FUTURE_MONTH_MESSAGE =
  "El mes inicial no puede ser posterior al actual. Elegí el mes actual o uno anterior.";
export const INVALID_BALANCE_AMOUNT_MESSAGE =
  "Ingresa un monto válido, con dígitos y un punto para los decimales.";
export const REPEATED_ACCOUNT_MESSAGE = "Esta cuenta está repetida.";
export const ACCOUNT_ROW_REQUIRED_MESSAGE = "Falta la cuenta.";
export const INVALID_OPENING_BALANCE_MESSAGE = "Corrige los campos resaltados.";
// An account of the editor was deleted, is not the user's or changed currency while the editor was
// open: nothing is saved and the editor is reopened with fresh accounts. (An archived account is not
// a reason: one that already has an amount stays editable, so it can be corrected.)
export const OPENING_ACCOUNTS_CHANGED_MESSAGE =
  "Tus cuentas cambiaron mientras editabas. Cerrá el saldo inicial y volvé a abrirlo.";
