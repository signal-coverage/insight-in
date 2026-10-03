import type {
  RecurringChoice,
  RecurringDecisionValue,
} from "@/core/expenses/types";

// In the order the radios appear.
export const CHOICE_OPTIONS: readonly {
  value: RecurringChoice;
  label: string;
}[] = [
  { value: "enable", label: "Habilitar" },
  { value: "disable", label: "Deshabilitar" },
  { value: "remove", label: "Quitar" },
];

export const DECIDED_LABELS: Record<RecurringDecisionValue, string> = {
  ENABLED: "Habilitado",
  DISABLED: "Deshabilitado",
};

// The colour classes are in app/globals.css (`.choice--positive`, `.choice--negative`): Habilitar
// confirms the expense (green), Quitar removes it for good (red), and Deshabilitar, which only skips
// the month, stays neutral.
export const CHOICE_CLASS_NAMES: Record<RecurringChoice, string | undefined> = {
  enable: "choice--positive",
  disable: undefined,
  remove: "choice--negative",
};

// An enabled decision is green like the choice that made it; a disabled one stays neutral.
export const DECIDED_CLASS_NAMES: Record<RecurringDecisionValue, string> = {
  ENABLED: "bg-positive-soft text-positive-soft-foreground",
  DISABLED: "",
};

export const decisionAriaLabel = (description: string): string =>
  `Decisión para ${description}`;
