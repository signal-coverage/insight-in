import {
  ACCOUNT_ARCHIVED_MESSAGE,
  ACCOUNT_CHOICE_NOT_FOUND_MESSAGE,
  ACCOUNT_CURRENCY_MISMATCH_MESSAGE,
} from "@/core/accounts/consts";
import { OVERVIEW_PATH } from "@/core/balances/consts";
import { BANKS_PATH } from "@/core/banks/consts";

import type { TransferAccountProblem } from "./errors";

export const TRANSFERS_PATH = "/dashboard/transfers";

// Moving money changes what the Banks board and the summary's "Por cuenta" card show, so a write
// refreshes all three pages.
export const TRANSFER_REVALIDATE_PATHS = [
  TRANSFERS_PATH,
  BANKS_PATH,
  OVERVIEW_PATH,
] as const;

export const TRANSFER_FORM_FIELDS = [
  "currency",
  "fromAccountId",
  "toAccountId",
  "amount",
  "date",
  "notes",
] as const;

// A month of transfers is read whole (the list has no pages); a real month never gets near this.
export const MAX_TRANSFERS_PER_MONTH = 500;

export const TRANSFER_NOT_FOUND_MESSAGE = "No se encontró la transferencia.";
export const TRANSFERS_NOT_FOUND_MESSAGE =
  "No se encontraron las transferencias seleccionadas.";

export const FROM_ACCOUNT_REQUIRED_MESSAGE = "Elegí la cuenta de origen.";
export const TO_ACCOUNT_REQUIRED_MESSAGE = "Elegí la cuenta de destino.";
export const SAME_ACCOUNT_MESSAGE =
  "El origen y el destino tienen que ser cuentas distintas.";
export const FUTURE_DATE_MESSAGE = "La fecha no puede ser posterior a hoy.";
export const DATE_RANGE_MESSAGE =
  "Ingresá una fecha entre los años 2000 y 2099.";

// `available` is already formatted in the currency of the transfer.
export const insufficientFundsMessage = (available: string): string =>
  `La cuenta de origen no tiene fondos suficientes: a esa fecha tenía ${available}.`;

// What each problem of an account says, on the field of the side it is about.
export const ACCOUNT_PROBLEM_MESSAGES: Readonly<
  Record<TransferAccountProblem, string>
> = {
  NOT_FOUND: ACCOUNT_CHOICE_NOT_FOUND_MESSAGE,
  ARCHIVED: ACCOUNT_ARCHIVED_MESSAGE,
  CURRENCY_MISMATCH: ACCOUNT_CURRENCY_MISMATCH_MESSAGE,
};

// Said when undoing a transfer (a delete, or an edit that takes money back) would push the account that
// has to give it back below zero. `available` and `amount` are already formatted in its currency.
export const giveBackMessage = (
  accountLabel: string,
  available: string,
  amount: string,
): string =>
  `No se puede deshacer: ${accountLabel} tiene ${available} y tendría que devolver ${amount}.`;
