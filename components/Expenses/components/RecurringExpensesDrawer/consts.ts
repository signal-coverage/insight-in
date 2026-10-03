import type { InstallmentsTableCopy } from "@/components/Entries/components/InstallmentsTable";

import { RECURRING_SWITCH_LABEL } from "../../consts";
import type { ConfirmRowCopy } from "./components/ConfirmRowDialog";
import type { TemplateFormTarget } from "./components/TemplateFormDrawer";

export const heading = (monthLabel: string): string =>
  `Gastos recurrentes de ${monthLabel}`;

export const DESCRIPTION =
  "Decidí qué pasa con cada uno este mes. Si cambiás un monto, queda guardado para los próximos meses.";

// Added to the description when there are purchases in installments to resolve.
export const INSTALLMENTS_DESCRIPTION =
  "En las compras en cuotas, elegí cuántas cuotas pagás este mes.";

export const RECURRING_HEADING = "Gastos recurrentes";
export const INSTALLMENTS_HEADING = "Compras en cuotas";

// The words of the table of purchases in installments.
export const INSTALLMENTS_TABLE_COPY: InstallmentsTableCopy = {
  purchaseHeader: "Compra",
  tableLabel: "Compras en cuotas",
  loadingLabel: "Cargando compras en cuotas",
};

export const CANCEL_LABEL = "Cancelar";
export const APPLY_LABEL = "Aplicar";
export const APPLY_PENDING_LABEL = "Aplicando…";

export const EMPTY_MESSAGE = `Todavía no tenés gastos recurrentes. Creá un gasto y activá «${RECURRING_SWITCH_LABEL}», o cargá una compra en cuotas.`;

// What the confirmations say. Disabling an enabled month deletes the month's expense, which the
// server only allows while it is still pending; removing deletes the template for good.
export const DISABLE_COPY: ConfirmRowCopy = {
  heading: "¿Deshabilitar este mes?",
  body: (description) =>
    `Se va a eliminar el gasto de este mes porque todavía está pendiente. ¿Deshabilitar «${description}» este mes?`,
  confirmLabel: "Deshabilitar",
  pendingLabel: "Deshabilitando…",
};

export const REMOVE_COPY: ConfirmRowCopy = {
  heading: "¿Quitar este gasto recurrente?",
  body: (description) =>
    `¿Quitar «${description}»? Deja de ser un gasto recurrente. Los gastos que ya creó se conservan.`,
  confirmLabel: "Quitar",
  pendingLabel: "Quitando…",
};

export const INITIAL_FORM_TARGET: TemplateFormTarget = {
  key: 0,
  template: null,
};
