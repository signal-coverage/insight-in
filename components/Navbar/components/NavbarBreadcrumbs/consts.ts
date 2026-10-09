export const HOME_LABEL = "Panel";
export const HOME_HREF = "/dashboard";

// Routes keep their English slugs; the breadcrumb shows the Spanish name. A segment that is
// not listed falls back to its capitalized slug.
export const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  incomes: "Ingresos",
  expenses: "Gastos",
  cards: "Tarjetas",
  banks: "Bancos",
  transfers: "Transferencias",
  roadmap: "Hoja de ruta",
  overview: "Resumen",
  project: "Proyecto",
  revenue: "Facturación",
  insights: "Conversiones",
  billing: "Cobros",
  calendar: "Calendario",
  invoices: "Facturas",
  help: "Ayuda",
  account: "Cuenta",
  settings: "Configuración",
};
