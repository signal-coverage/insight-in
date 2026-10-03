import type { LimitModeOption } from "./types";

export const LIMIT_MODE_LABEL = "Tipo de tope";

// The field name the form submits the kind of cap under.
export const LIMIT_MODE_FIELD_NAME = "limitMode";

// A card has one kind of cap, never both. In the order the radios appear.
export const LIMIT_MODE_OPTIONS: readonly LimitModeOption[] = [
  {
    value: "MONTHLY",
    label: "Mensual",
    hint: "Lo máximo que querés pagar por mes con esta tarjeta",
  },
  {
    value: "TOTAL",
    label: "Total",
    hint: "Lo máximo que querés tener comprometido en cuotas pendientes",
  },
];
