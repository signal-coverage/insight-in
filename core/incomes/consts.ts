import type { DineroCurrency } from "dinero.js";
import * as dineroCurrencies from "dinero.js/currencies";

import { DISPLAY_LOCALE } from "@/lib/locale";

// Only base-10 currencies are supported: the decimal <-> minor units conversion in
// money.ts relies on a plain power-of-ten exponent.
const isBase10 = (currency: DineroCurrency<number>): boolean =>
  currency.base === 10;

const ALL_CURRENCIES = Object.values(
  dineroCurrencies,
) as DineroCurrency<number>[];

export const SUPPORTED_CURRENCIES: readonly DineroCurrency<number>[] =
  ALL_CURRENCIES.filter(isBase10);

export const SUPPORTED_CURRENCY_CODES: readonly string[] =
  SUPPORTED_CURRENCIES.map((currency) => currency.code);

// Listed first in the currency picker; the rest follow alphabetically.
export const PRIORITY_CURRENCY_CODES: readonly string[] = [
  "ARS",
  "USD",
  "EUR",
  "BRL",
  "GBP",
];

export const DEFAULT_CURRENCY_CODE = "ARS";

export { DISPLAY_LOCALE };

export const INCOMES_PATH = "/dashboard/incomes";

export const DESCRIPTION_MAX_LENGTH = 200;
export const CATEGORY_NAME_MAX_LENGTH = 40;
export const NOTES_MAX_LENGTH = 1000;

// Amounts are stored as BigInt but handled as numbers, so they must stay exactly
// representable.
export const MAX_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

export const INCOME_FORM_FIELDS = [
  "description",
  "amount",
  "currency",
  "date",
  "categoryId",
  "notes",
  "status",
] as const;

export const NOT_SIGNED_IN_MESSAGE = "Debes iniciar sesión.";
// Seeded for a user who has no categories yet.
export const DEFAULT_CATEGORY_NAMES: readonly string[] = [
  "Sueldo",
  "Freelance",
  "Inversiones",
  "Regalos",
  "Otros",
];

export const NOT_FOUND_MESSAGE = "No se encontró el ingreso.";
export const INVALID_FORM_MESSAGE = "Corrige los campos resaltados.";
export const GENERIC_ERROR_MESSAGE = "Algo salió mal. Inténtalo de nuevo.";
export const INVALID_CATEGORY_MESSAGE = "Selecciona una categoría válida.";
export const DUPLICATE_CATEGORY_MESSAGE =
  "Ya tienes una categoría con este nombre.";
export const CATEGORY_NOT_FOUND_MESSAGE = "No se encontró la categoría.";
export const LAST_CATEGORY_MESSAGE = "Se necesita al menos una categoría.";

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// Names what still uses the category: incomes, recurring incomes, or both.
export const categoryInUseMessage = (
  count: number,
  recurringCount = 0,
): string => {
  const total = count + recurringCount;
  const subjects = [
    count > 0 ? plural(count, "ingreso", "ingresos") : null,
    recurringCount > 0
      ? plural(recurringCount, "ingreso recurrente", "ingresos recurrentes")
      : null,
  ]
    .filter(Boolean)
    .join(" y ");

  return total === 1
    ? `${subjects} todavía usa esta categoría. Muévelo o elimínalo primero.`
    : `${subjects} todavía usan esta categoría. Muévelos o elimínalos primero.`;
};

export const INCOMES_PAGE_SIZE = 25;

export const RECURRING_NOT_FOUND_MESSAGE =
  "No se encontró el ingreso recurrente.";

export const RECURRING_FORM_FIELDS = [
  "description",
  "amount",
  "currency",
  "categoryId",
  "notes",
  "frequency",
  "startDate",
  "endDate",
] as const;
