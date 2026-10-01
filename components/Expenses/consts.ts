import {
  ArrowPathIcon,
  PlusIcon,
  ReceiptPercentIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ManageCategoriesCopy } from "@/components/Entries/components/ManageCategoriesDrawer/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

import type { FormTarget } from "./types";

export const PAGE_TITLE = "Gastos";
export const PAGE_DESCRIPTION =
  "Registra y revisa el dinero que gastas, en cualquier moneda.";
export const ADD_EXPENSE_LABEL = "Agregar gasto";
export const ACTIONS_LABEL = "Acciones";
export const MANAGE_CATEGORIES_LABEL = "Administrar categorías";
export const RECURRING_EXPENSES_LABEL = "Gastos recurrentes";

export const SETTLED_LABEL = "Pagado";
export const PENDING_LABEL = "Por pagar";
export const STATUS_SWITCH_LABEL = "Ya pagado";
export const RECURRING_SWITCH_LABEL = "Gasto recurrente";
export const RECURRING_MARKER_LABEL = "Recurrente";
// Shown under the switch of an expense that already belongs to a recurring template.
export const RECURRING_LOCKED_HINT =
  "Para dejar de repetirlo, usá Gastos recurrentes y elegí Quitar.";

export const markSettledLabel = (description: string): string =>
  `Marcar ${description} como pagado`;

export const dayLabel = (dayOfMonth: number): string => `Día ${dayOfMonth}`;

export const TOTALS_COPY = {
  ariaLabel: "Total de gastos por moneda",
  settledLabel: SETTLED_LABEL,
  pendingLabel: PENDING_LABEL,
};

export const FILTERS_COPY = {
  ariaLabel: "Filtrar gastos",
  settledLabel: SETTLED_LABEL,
};

export const EMPTY_COPY: EntriesEmptyStateCopy = {
  empty: {
    icon: ReceiptPercentIcon,
    title: "Todavía no hay gastos",
    hint: "Agrega tu primer gasto para empezar a registrar en qué gastas.",
    action: "Agregar gasto",
  },
  filtered: {
    title: "Ningún gasto coincide con estos filtros",
    hint: "Prueba cambiando las fechas, la categoría, la moneda o el estado.",
  },
};

const expenseCountLabel = (count: number): string => {
  if (count === 0) {
    return "Sin gastos";
  }

  return count === 1 ? "1 gasto" : `${count} gastos`;
};

export const CATEGORIES_COPY: ManageCategoriesCopy = {
  heading: "Administrar categorías",
  description:
    "Agrega categorías, cambia su nombre o elimina las que ya no uses.",
  listAriaLabel: "Categorías de gastos",
  countLabel: expenseCountLabel,
};

export const ADD_EXPENSE_ACTION = "add-expense";
export const MANAGE_CATEGORIES_ACTION = "manage-categories";
export const RECURRING_EXPENSES_ACTION = "recurring-expenses";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  { id: ADD_EXPENSE_ACTION, label: ADD_EXPENSE_LABEL, Icon: PlusIcon },
  {
    id: MANAGE_CATEGORIES_ACTION,
    label: MANAGE_CATEGORIES_LABEL,
    Icon: TagIcon,
  },
  {
    id: RECURRING_EXPENSES_ACTION,
    label: RECURRING_EXPENSES_LABEL,
    Icon: ArrowPathIcon,
  },
];

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  expense: null,
  defaultDate: "",
};
