import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  PlusIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

import type { BulkDeleteCopy } from "@/components/Entries/components/BulkDeleteDialog";
import type { OriginSectionCopy } from "@/components/Entries/components/OriginSection";
import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ManageCategoriesCopy } from "@/components/Entries/components/ManageCategoriesDrawer/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";
import { HELP_ACTION_ITEM } from "@/components/Entries/consts";
import { MARKERS } from "@/components/Entries/markers";

import type {
  FormTarget,
  RecurringFormTarget,
  RepaymentPlannerTarget,
} from "./types";

export const PAGE_TITLE = "Ingresos";
export const PAGE_DESCRIPTION =
  "Registra y revisa el dinero que recibes, en cualquier moneda.";
export const ADD_INCOME_LABEL = "Agregar ingreso";
export const ACTIONS_LABEL = "Acciones";
export const MANAGE_CATEGORIES_LABEL = "Administrar categorías";
export const RECURRING_LABEL = "Recurrentes";
export const RECURRING_MARKER_LABEL = MARKERS.recurring.label;
// A loan someone repays to the user in installments, and the month's list of them.
export const REPAYMENT_PLANNER_LABEL = "Devolución en cuotas";
export const REPAYMENTS_LABEL = "Devoluciones en cuotas";

// The words of an income's origin ("Viene de 1.000,00 USDC · cotización 1.200,00").
export const ORIGIN_PREFIX = "Viene de";

// The collapsed section of the income form that records where the net amount came from.
export const ORIGIN_SECTION_COPY: OriginSectionCopy = {
  heading: "Viene de otra moneda",
  hint: "Si lo que cobraste viene de otra moneda, por ejemplo USDC, anotá de cuánto partiste. Es solo una referencia: los totales usan el monto de arriba.",
  currencyLabel: "Moneda de origen",
  amountLabel: "Monto de origen",
};

export const FREQUENCY_LABELS = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  YEARLY: "Anual",
} as const;

// What the marker of an income that pays an expense back says in its tooltip.
export const reimbursesTooltip = (description: string): string =>
  `Devolución de: ${description}`;

// How the form offers an expense that still expects money: "Dentista · 12/09 · faltan $ 4.000,00".
export const reimbursableLabel = (
  description: string,
  day: string,
  owed: string,
): string => `${description} · ${day} · faltan ${owed}`;

// How the form keeps offering the expense an income already pays back once nothing is owed on it.
export const reimbursableRepaidLabel = (description: string): string =>
  `${description} · reintegro completo`;

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

// What the dialog asks before deleting the selected incomes.
export const BULK_DELETE_COPY: BulkDeleteCopy = {
  heading: (count) =>
    count === 1 ? "¿Eliminar 1 ingreso?" : `¿Eliminar ${count} ingresos?`,
};

export const ADD_INCOME_ACTION = "add-income";
export const RECURRING_ACTION = "recurring";
export const MANAGE_CATEGORIES_ACTION = "manage-categories";
export const REPAYMENT_PLANNER_ACTION = "repayment-planner";
export const REPAYMENTS_ACTION = "repayments";

// What the Actions menu offers, in order.
export const ACTION_ITEMS: readonly ActionsMenuItem[] = [
  { id: ADD_INCOME_ACTION, label: ADD_INCOME_LABEL, Icon: PlusIcon },
  { id: RECURRING_ACTION, label: RECURRING_LABEL, Icon: ArrowPathIcon },
  {
    id: REPAYMENT_PLANNER_ACTION,
    label: REPAYMENT_PLANNER_LABEL,
    Icon: ArrowUturnLeftIcon,
  },
  {
    id: REPAYMENTS_ACTION,
    label: REPAYMENTS_LABEL,
    Icon: CalendarDaysIcon,
  },
  {
    id: MANAGE_CATEGORIES_ACTION,
    label: MANAGE_CATEGORIES_LABEL,
    Icon: TagIcon,
  },
  HELP_ACTION_ITEM,
];

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  income: null,
  defaultDate: "",
};

export const INITIAL_REPAYMENT_PLANNER_TARGET: RepaymentPlannerTarget = {
  key: 0,
  defaultDate: "",
};

export const INITIAL_RECURRING_TARGET: RecurringFormTarget = {
  key: 0,
  recurring: null,
  defaultDate: "",
};
