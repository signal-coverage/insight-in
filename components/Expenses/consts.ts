import {
  ArrowPathIcon,
  CreditCardIcon,
  PlusIcon,
  ReceiptPercentIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

import type { BulkDeleteCopy } from "@/components/Entries/components/BulkDeleteDialog";
import type { OriginSectionCopy } from "@/components/Entries/components/OriginSection";
import type { EntriesEmptyStateCopy } from "@/components/Entries/components/EntriesEmptyState/types";
import type { ManageCategoriesCopy } from "@/components/Entries/components/ManageCategoriesDrawer/types";
import type { ActionsMenuItem } from "@/components/Entries/components/PageHeader";
import { HELP_ACTION_ITEM } from "@/components/Entries/consts";
import { MARKERS } from "@/components/Entries/markers";

import type { FormTarget, PlannerTarget } from "./types";

export const PAGE_TITLE = "Gastos";
export const PAGE_DESCRIPTION =
  "Registra y revisa el dinero que gastas, en cualquier moneda.";
export const ADD_EXPENSE_LABEL = "Agregar gasto";
export const ACTIONS_LABEL = "Acciones";
export const MANAGE_CATEGORIES_LABEL = "Administrar categorías";
export const RECURRING_EXPENSES_LABEL = "Gastos recurrentes";
export const INSTALLMENT_PLANNER_LABEL = "Compra en cuotas";

export const SETTLED_LABEL = "Pagado";
export const PENDING_LABEL = "Por pagar";
export const RECURRING_SWITCH_LABEL = "Gasto recurrente";
export const RECURRING_MARKER_LABEL = MARKERS.recurring.label;
// Shown in the Status column of an expense someone else paid.
export const COVERED_MARKER_LABEL = MARKERS.covered.label;
// Shown under the switch of an expense that already belongs to a recurring template.
export const RECURRING_LOCKED_HINT =
  "Para dejar de repetirlo, usá Gastos recurrentes y elegí Quitar.";

// The words of an expense's quoted price ("Se cotizó en 20 USD · cotización 1.750,00") and of the
// reference a template shows in the wizard ("Referencia: US$ 20,00").
export const ORIGIN_PREFIX = "Se cotizó en";
export const REFERENCE_PREFIX = "Referencia:";

// The collapsed section of the expense and template forms that records the price in another currency.
export const ORIGIN_SECTION_COPY: OriginSectionCopy = {
  heading: "Se cotizó en otra moneda",
  hint: "Si el precio estaba en otra moneda, por ejemplo 20 USD, anotalo acá. Es solo una referencia: los totales usan el monto de arriba.",
  currencyLabel: "Moneda del precio",
  amountLabel: "Precio en esa moneda",
};

// The marker of an expense that expects to be paid back.
export const REIMBURSEMENT_MARKER_LABEL = MARKERS.reimbursement.label;
export const REIMBURSEMENT_COMPLETE_LABEL = "Reintegro completo";

// "Te deben $ 4.000,00 de $ 10.000,00": what is still owed out of what was expected.
export const reimbursementOwedLabel = (
  owed: string,
  expected: string,
): string => `Te deben ${owed} de ${expected}`;

// "Te deben $ 4.000,00": nothing has come back yet, so "de" the same amount would only repeat it.
export const reimbursementOwedInFullLabel = (owed: string): string =>
  `Te deben ${owed}`;

export const markSettledLabel = (description: string): string =>
  `Marcar ${description} como pagado`;

export const dayLabel = (dayOfMonth: number): string => `Día ${dayOfMonth}`;

export const TOTALS_COPY = {
  ariaLabel: "Total de gastos por moneda",
  settledLabel: SETTLED_LABEL,
  pendingLabel: PENDING_LABEL,
};

export const COVERED_LABEL = "Cubierta";

export const FILTERS_COPY = {
  ariaLabel: "Filtrar gastos",
  settledLabel: SETTLED_LABEL,
  coveredLabel: COVERED_LABEL,
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

// What the dialog asks before deleting the selected expenses.
export const BULK_DELETE_COPY: BulkDeleteCopy = {
  heading: (count) =>
    count === 1 ? "¿Eliminar 1 gasto?" : `¿Eliminar ${count} gastos?`,
};

export const ADD_EXPENSE_ACTION = "add-expense";
export const MANAGE_CATEGORIES_ACTION = "manage-categories";
export const RECURRING_EXPENSES_ACTION = "recurring-expenses";
export const INSTALLMENT_PLANNER_ACTION = "installment-planner";

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
  {
    id: INSTALLMENT_PLANNER_ACTION,
    label: INSTALLMENT_PLANNER_LABEL,
    Icon: CreditCardIcon,
  },
  HELP_ACTION_ITEM,
];

export const INITIAL_FORM_TARGET: FormTarget = {
  key: 0,
  expense: null,
  defaultDate: "",
};

export const INITIAL_PLANNER_TARGET: PlannerTarget = {
  key: 0,
  defaultDate: "",
};
