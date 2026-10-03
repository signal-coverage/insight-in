import { SUPPORTED_CURRENCY_CODES } from "@/core/incomes/consts";

// The summary shows the opening balance, so saving it refreshes this page.
export const OVERVIEW_PATH = "/dashboard/overview";

// One row per currency at most: a forged payload cannot ask for more writes than that.
export const MAX_OPENING_CURRENCIES = SUPPORTED_CURRENCY_CODES.length;

export const INVALID_MONTH_MESSAGE = "Selecciona un mes válido.";
export const INVALID_BALANCE_AMOUNT_MESSAGE =
  "Ingresa un monto válido, con dígitos y un punto para los decimales.";
export const DUPLICATE_CURRENCY_MESSAGE = "Esta moneda está repetida.";
export const INVALID_OPENING_BALANCE_MESSAGE = "Corrige los campos resaltados.";
