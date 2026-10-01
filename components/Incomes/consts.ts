import {
  ArrowPathIcon,
  BanknotesIcon,
  PlusIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ManageCategoriesCopy } from "@/components/Entries/components/ManageCategoriesDrawer/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";

import type { FormTarget, RecurringFormTarget } from "./types";

export const PAGE_TITLE = "Ingresos";
export const PAGE_DESCRIPTION =
  "Registra y revisa el dinero que recibes, en cualquier moneda.";
export const ADD_INCOME_LABEL = "Agregar ingreso";
export const ACTIONS_LABEL = "Acciones";
export const MANAGE_CATEGORIES_LABEL = "Administrar categorías";
export const RECURRING_LABEL = "Recurrentes";
export const RECURRING_MARKER_LABEL = "Recurrente";

export const FREQUENCY_LABELS = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
} as const;

export const SETTLED_LABEL = "Cobrado";
export const PENDING_LABEL = "Por cobrar";
export const STATUS_SWITCH_LABEL = "Ya cobrado";

export const markSettledLabel = (description: string): string =>
  `Marcar ${description} como cobrado`;

export const TOTALS_COPY = {
  ariaLabel: "Total de ingresos por moneda",
  settledLabel: SETTLED_LABEL,
  pendingLabel: PENDING_LABEL,
};

export const FILTERS_COPY = {
  ariaLabel: "Filtrar ingresos",
  settledLabel: SETTLED_LABEL,
};

export const EMPTY_COPY: EntriesEmptyStateCopy = {
  empty: {
    icon: BanknotesIcon,
    title: "Todavía no hay ingresos",
    hint: "Agrega tu primer ingreso para empezar a registrar lo que recibes.",
    action: "Agregar ingreso",
  },
  filtered: {
    title: "Ningún ingreso coincide con estos filtros",
    hint: "Prueba cambiando las fechas, la categoría o la moneda.",
  },
};

const incomeCountLabel = (count: number): string => {
  if (count === 0) {
    return "Sin ingresos";
  }

  return count === 1 ? "1 ingreso" : `${count} ingresos`;
};

export const CATEGORIES_COPY: ManageCategoriesCopy = {
  heading: "Administrar categorías",
  description:
    "Agrega categorías, cambia su nombre o elimina las que ya no uses.",
  listAriaLabel: "Categorías de ingresos",
  countLabel: incomeCountLabel,
};

export const ADD_INCOME_ACTION = "add-income";
export const RECURRING_ACTION = "recurring";
export const MANAGE_CATEGORIES_ACTION = "manage-categories";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  { id: ADD_INCOME_ACTION, label: ADD_INCOME_LABEL, Icon: PlusIcon },
  { id: RECURRING_ACTION, label: RECURRING_LABEL, Icon: ArrowPathIcon },
  {
    id: MANAGE_CATEGORIES_ACTION,
    label: MANAGE_CATEGORIES_LABEL,
    Icon: TagIcon,
  },
];

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  income: null,
  defaultDate: "",
};

export const INITIAL_RECURRING_TARGET: RecurringFormTarget = {
  key: 0,
  recurring: null,
  defaultDate: "",
};
