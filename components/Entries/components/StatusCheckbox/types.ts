export interface StatusCheckboxProps {
  isSettled: boolean;
  // Accessible name, e.g. "Marcar Sueldo como cobrado".
  label: string;
  isDisabled?: boolean;
  onChange: (isSettled: boolean) => void;
}
