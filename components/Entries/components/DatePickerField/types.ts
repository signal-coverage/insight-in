export type DatePickerFieldProps = {
  label: string;
  // Submitted as an ISO "YYYY-MM-DD" string under this name ("" when empty).
  name?: string;
  // Uncontrolled: the initial ISO date.
  defaultValue?: string | null;
  // Controlled: the current ISO date (null = empty).
  value?: string | null;
  onChange?: (value: string | null) => void;
  isRequired?: boolean;
  description?: string;
  className?: string;
};
