import type { AmountModeOption } from "./types";

export const AMOUNT_MODE_LABEL = "Cómo ingresar el monto";

// How the single amount is read, in the order they are offered.
export const AMOUNT_MODE_OPTIONS: readonly AmountModeOption[] = [
  { value: "total", label: "Monto total" },
  { value: "perInstallment", label: "Monto por cuota" },
];
