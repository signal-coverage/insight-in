export const EXPENSES_PATH = "/dashboard/expenses";

// The summary counts the expenses the wizard creates.
export const OVERVIEW_PATH = "/dashboard/overview";

export const EXPENSES_PAGE_SIZE = 25;

export const EXPENSE_FORM_FIELDS = [
  "description",
  "amount",
  "currency",
  "date",
  "categoryId",
  "notes",
  "status",
  "isRecurring",
] as const;

// Seeded for a user who has no expense categories yet.
export const DEFAULT_EXPENSE_CATEGORY_NAMES: readonly string[] = [
  "Alquiler",
  "Servicios",
  "Comida",
  "Transporte",
  "Salud",
  "Otros",
];

export const EXPENSE_NOT_FOUND_MESSAGE = "No se encontró el gasto.";

// What the user can do with a recurring template in the monthly wizard.
export const RECURRING_CHOICES = ["enable", "disable", "remove"] as const;

// More than a person could have; keeps a forged payload from asking for thousands of writes.
export const MAX_RECURRING_DECISIONS = 200;

export const RECURRING_INVALID_MESSAGE =
  "No se pudo aplicar la decisión. Revisá los datos e intentá de nuevo.";

export const invalidRecurringAmountMessage = (description: string): string =>
  `Ingresá un monto válido para «${description}».`;

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// Names what still uses the category: expenses, recurring expenses, or both.
export const expenseCategoryInUseMessage = (
  count: number,
  recurringCount = 0,
): string => {
  const subjects = [
    count > 0 ? plural(count, "gasto", "gastos") : null,
    recurringCount > 0
      ? plural(recurringCount, "gasto recurrente", "gastos recurrentes")
      : null,
  ]
    .filter(Boolean)
    .join(" y ");

  return count + recurringCount === 1
    ? `${subjects} todavía usa esta categoría. Muévelo o elimínalo primero.`
    : `${subjects} todavía usan esta categoría. Muévelos o elimínalos primero.`;
};
