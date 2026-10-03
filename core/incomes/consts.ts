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
  "medium",
  "originCurrency",
  "originAmount",
  "reimbursesExpenseId",
] as const;

export const ORIGIN_CURRENCY_MESSAGE = "Elegí la moneda de origen.";
export const ORIGIN_AMOUNT_MESSAGE = "Ingresá un monto de origen válido.";

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
export const INCOMES_NOT_FOUND_MESSAGE =
  "No se encontraron los ingresos seleccionados.";
export const INVALID_FORM_MESSAGE = "Corrige los campos resaltados.";
export const GENERIC_ERROR_MESSAGE = "Algo salió mal. Inténtalo de nuevo.";
export const INVALID_CATEGORY_MESSAGE = "Selecciona una categoría válida.";
export const DUPLICATE_CATEGORY_MESSAGE =
  "Ya tienes una categoría con este nombre.";
export const CATEGORY_NOT_FOUND_MESSAGE = "No se encontró la categoría.";
export const LAST_CATEGORY_MESSAGE = "Se necesita al menos una categoría.";
// COVERED was asked for something that is not an expense: only expenses can be paid by someone else.
export const COVERED_NOT_ALLOWED_MESSAGE =
  "Solo los gastos pueden estar cubiertos por otra persona.";

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// "a", "a y b", "a, b y c".
const joinSubjects = (subjects: readonly string[]): string =>
  subjects.length < 2
    ? (subjects[0] ?? "")
    : `${subjects.slice(0, -1).join(", ")} y ${subjects[subjects.length - 1]}`;

// Names what still uses the category: incomes, recurring incomes, loans repaid in installments, or
// any mix. Only the loans alone read feminine ("devolución").
export const categoryInUseMessage = (
  count: number,
  recurringCount = 0,
  installmentCount = 0,
): string => {
  const total = count + recurringCount + installmentCount;
  const subjects = joinSubjects(
    [
      count > 0 ? plural(count, "ingreso", "ingresos") : null,
      recurringCount > 0
        ? plural(recurringCount, "ingreso recurrente", "ingresos recurrentes")
        : null,
      installmentCount > 0
        ? plural(
            installmentCount,
            "devolución en cuotas",
            "devoluciones en cuotas",
          )
        : null,
    ].filter((subject): subject is string => subject !== null),
  );

  if (count + recurringCount === 0) {
    return total === 1
      ? `${subjects} todavía usa esta categoría. Muévela o elimínala primero.`
      : `${subjects} todavía usan esta categoría. Muévelas o elimínalas primero.`;
  }

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
  "medium",
  "frequency",
  "startDate",
  "endDate",
] as const;
