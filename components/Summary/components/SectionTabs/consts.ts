import type { SummarySection } from "@/core/summary/tabs";

export const TABS_LABEL = "Secciones del resumen";

export const SECTION_LABELS: Readonly<Record<SummarySection, string>> = {
  accounts: "Cuentas y atención",
  month: "El mes en detalle",
  history: "Últimos 6 meses",
};
