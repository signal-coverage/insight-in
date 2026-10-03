import type { OwnershipOption } from "./types";

export const OWNERSHIP_LABEL = "Tarjeta";

export const BORROWED_HINT =
  "Usás la tarjeta de otra persona y después le pagás a ella.";

// Whose card pays the purchase, in the order they are offered.
export const OWNERSHIP_OPTIONS: readonly OwnershipOption[] = [
  { value: "own", label: "Propia" },
  { value: "borrowed", label: "Prestada", description: BORROWED_HINT },
];
