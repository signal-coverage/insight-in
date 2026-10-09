// The word each row's accessible name starts with is the row's own title; see `rowLabel` in utils.
// This is the section's: "Resumen en ARS".
export const SECTION_LABEL = "Resumen";

// The paid bar under Gastos: its name for assistive technology and its words beside it.
export const paidLabel = (currency: string): string =>
  `Pagado del total en ${currency}`;

export const paidText = (percent: number): string => `${percent} % pagado`;
