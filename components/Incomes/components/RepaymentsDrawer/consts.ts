import type { InstallmentsTableCopy } from "@/components/Entries/components/InstallmentsTable";

export const heading = (monthLabel: string): string =>
  `Devoluciones en cuotas de ${monthLabel}`;

export const DESCRIPTION = "Elegí cuántas cuotas cobrás este mes.";

export const EMPTY_MESSAGE =
  "Todavía no tenés devoluciones en cuotas. Cargá una desde Acciones.";

// The words of the table of loans repaid in installments.
export const TABLE_COPY: InstallmentsTableCopy = {
  purchaseHeader: "Concepto",
  tableLabel: "Devoluciones en cuotas",
  loadingLabel: "Cargando devoluciones en cuotas",
};

export const CANCEL_LABEL = "Cancelar";
export const APPLY_LABEL = "Aplicar";
export const APPLY_PENDING_LABEL = "Aplicando…";
