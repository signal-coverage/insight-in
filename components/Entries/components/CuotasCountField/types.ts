export interface CuotasCountFieldProps {
  // The number of installments, or null while the field is empty.
  value: number | null;
  onChange: (value: number | null) => void;
}
