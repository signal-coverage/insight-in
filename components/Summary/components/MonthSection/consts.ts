import type { SummaryView } from "../../types";

// What each view's block is called, and the id its heading carries (one per view).
export const SECTION_TITLES: Readonly<Record<SummaryView, string>> = {
  month: "El mes en detalle",
  history: "Últimos 6 meses",
};

export const HEADING_IDS: Readonly<Record<SummaryView, string>> = {
  month: "month-heading",
  history: "history-heading",
};
