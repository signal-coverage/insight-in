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

export const DECIDED_COLORS = {
  ENABLED: "success",
  DISABLED: "default",
} as const satisfies Record<RecurringDecisionValue, string>;

export const decisionAriaLabel = (description: string): string =>
  `Decisión para ${description}`;
