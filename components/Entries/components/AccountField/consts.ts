export const ACCOUNT_LABEL = "Cuenta";

// Shown while no account is chosen.
export const ACCOUNT_PLACEHOLDER = "Elegí una cuenta";

// The field name every entry form submits the account under.
export const ACCOUNT_FIELD_NAME = "accountId";

// After the label of an archived account that the record being edited already has.
export const ARCHIVED_SUFFIX = " (archivada)";

export const CREATE_ACCOUNT_LINK_LABEL = "Creá una en Bancos";

export const noAccountsHint = (currency: string): string =>
  `No tenés cuentas en ${currency}.`;
