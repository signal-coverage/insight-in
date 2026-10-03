import type { MediumOption } from "./types";

export const MEDIUM_LABEL = "Medio";

// The form value (the database enum) and what the user reads, in the order they are offered.
export const MEDIUM_OPTIONS: readonly MediumOption[] = [
  { value: "DIGITAL", label: "Digital" },
  { value: "CASH", label: "Efectivo" },
];

// The field name every entry form submits the medium under.
export const MEDIUM_FIELD_NAME = "medium";
