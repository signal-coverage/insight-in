// Same limit as the names of the categories.
export const ACCOUNT_NAME_MAX_LENGTH = 40;

export const CREATE_ACCOUNT_FORM_FIELDS = [
  "bankId",
  "name",
  "currency",
] as const;
// An edit never moves an account to another bank.
export const UPDATE_ACCOUNT_FORM_FIELDS = ["name", "currency"] as const;

// What a user gets the first time anything needs accounts: a bank for the cash, with one account.
export const DEFAULT_CASH_BANK_NAME = "Efectivo";
export const DEFAULT_CASH_ACCOUNT_NAME = "Efectivo";
export const DEFAULT_CASH_CURRENCY = "ARS";

export const ACCOUNT_NOT_FOUND_MESSAGE = "No se encontró la cuenta.";
export const DUPLICATE_ACCOUNT_MESSAGE =
  "Ya tenés una cuenta con este nombre en este banco.";
export const BANK_REQUIRED_MESSAGE = "Elegí un banco.";

// What the entry forms (incomes, expenses, templates, planners) say about the "Cuenta" field.
export const ACCOUNT_REQUIRED_MESSAGE = "Elegí una cuenta.";
export const ACCOUNT_CHOICE_NOT_FOUND_MESSAGE = "Elegí una cuenta válida.";
export const ACCOUNT_ARCHIVED_MESSAGE =
  "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.";
export const ACCOUNT_CURRENCY_MISMATCH_MESSAGE =
  "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.";
export const ACCOUNT_CURRENCY_LOCKED_MESSAGE =
  "La moneda no se puede cambiar: esta cuenta ya tiene movimientos.";

// Said when deleting an account that has history: archiving keeps the history and hides the account.
export const ACCOUNT_HAS_MOVEMENTS_MESSAGE =
  "Esta cuenta ya tiene movimientos, así que no se puede eliminar. Archivala en su lugar.";

export const accountHasBalanceMessage = (balanceLabel: string): string =>
  `Esta cuenta tiene un saldo de ${balanceLabel}. Dejala en cero antes de archivarla.`;

const countOf = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

// "3 movimientos pendientes y 1 recurrente", with the verb agreeing with what is listed.
export const accountInUseMessage = (
  pending: number,
  templates: number,
): string => {
  const parts = [
    pending > 0
      ? countOf(pending, "movimiento pendiente", "movimientos pendientes")
      : null,
    templates > 0 ? countOf(templates, "recurrente", "recurrentes") : null,
  ].filter((part): part is string => part !== null);
  const one = pending + templates === 1;

  return `Esta cuenta todavía tiene ${parts.join(" y ")}. ${
    one
      ? "Pasalo a otra cuenta o eliminalo"
      : "Pasalos a otra cuenta o eliminalos"
  } antes de archivarla.`;
};

// Said under "Moneda" when an entity bank's account is asked for a crypto currency.
export const ENTITY_LEGAL_TENDER_ONLY_MESSAGE =
  "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual.";
