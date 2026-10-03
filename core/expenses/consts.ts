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
  "medium",
  "isRecurring",
  "cardId",
  "originCurrency",
  "originAmount",
  "expectedReimbursement",
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
export const EXPENSES_NOT_FOUND_MESSAGE =
  "No se encontraron los gastos seleccionados.";

// What the user can do with a recurring template in the monthly wizard.
export const RECURRING_CHOICES = ["enable", "disable", "remove"] as const;

// More than a person could have; keeps a forged payload from asking for thousands of writes.
export const MAX_RECURRING_DECISIONS = 200;

export const RECURRING_INVALID_MESSAGE =
  "No se pudo aplicar la decisión. Revisá los datos e intentá de nuevo.";

// The fields the template form sends.
export const RECURRING_FORM_FIELDS = [
  "description",
  "amount",
  "currency",
  "categoryId",
  "notes",
  "medium",
  "originCurrency",
  "originAmount",
  "dayOfMonth",
] as const;

export const MIN_DAY_OF_MONTH = 1;
export const MAX_DAY_OF_MONTH = 31;

export const RECURRING_NOT_FOUND_MESSAGE =
  "No se encontró el gasto recurrente.";

// Why a recurring expense cannot be disabled for the month: the expense it created was already
// paid (or is covered by someone else), so its money already counts in the budget. Taking it out
// is a deliberate step: delete the expense from the table first.
export const recurringExpenseSettledMessage = (
  description: string,
  status: "SETTLED" | "COVERED",
): string =>
  `El gasto de este mes de «${description}» ya está ${
    status === "COVERED" ? "marcado como cubierto" : "pagado"
  } y suma en tu presupuesto. Para sacar ese dinero del presupuesto, eliminalo desde la tabla de Gastos y después deshabilitá el recurrente.`;

export const invalidRecurringAmountMessage = (description: string): string =>
  `Ingresá un monto válido para «${description}».`;

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

// "a", "a y b", "a, b y c".
const joinSubjects = (subjects: readonly string[]): string =>
  subjects.length < 2
    ? (subjects[0] ?? "")
    : `${subjects.slice(0, -1).join(", ")} y ${subjects[subjects.length - 1]}`;

// Names what still uses the category: expenses, recurring expenses, installment plans, or any mix.
// Only installment plans is the one case that reads feminine ("compra").
export const expenseCategoryInUseMessage = (
  count: number,
  recurringCount = 0,
  installmentCount = 0,
): string => {
  const subjects = joinSubjects(
    [
      count > 0 ? plural(count, "gasto", "gastos") : null,
      recurringCount > 0
        ? plural(recurringCount, "gasto recurrente", "gastos recurrentes")
        : null,
      installmentCount > 0
        ? plural(installmentCount, "compra en cuotas", "compras en cuotas")
        : null,
    ].filter((subject): subject is string => subject !== null),
  );
  const total = count + recurringCount + installmentCount;

  if (count + recurringCount === 0) {
    return total === 1
      ? `${subjects} todavía usa esta categoría. Muévela o elimínala primero.`
      : `${subjects} todavía usan esta categoría. Muévelas o elimínalas primero.`;
  }

  return total === 1
    ? `${subjects} todavía usa esta categoría. Muévelo o elimínalo primero.`
    : `${subjects} todavía usan esta categoría. Muévelos o elimínalos primero.`;
};
