export interface RecurringSwitchProps {
  defaultRecurring: boolean;
  label: string;
  // Given only for an expense that already belongs to a template: it locks the switch on.
  lockedHint?: string;
}
