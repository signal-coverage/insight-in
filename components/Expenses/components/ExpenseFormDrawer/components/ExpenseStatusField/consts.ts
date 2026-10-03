import type { ExpenseStatusOption } from "./types";

export const STATUS_LABEL = "Estado";

// The form value (the database enum) and what the user reads, in the order they are offered.
export const STATUS_OPTIONS: readonly ExpenseStatusOption[] = [
  { value: "PLANNED", label: "Pendiente" },
  { value: "SETTLED", label: "Pagada" },
  { value: "COVERED", label: "Cubierta por otro" },
];

export const COVERED_HINT =
  "Cubierta: la pagó otra persona, no se descuenta de tu plata.";

// The field name the expense form submits the status under.
export const STATUS_FIELD_NAME = "status";
