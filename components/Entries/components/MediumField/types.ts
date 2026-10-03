import type { PaymentMedium } from "@/core/entries/medium";

export interface MediumFieldProps {
  // The medium selected when the form opens: digital for a new entry, the stored one on edit.
  defaultMedium: PaymentMedium;
  // For a parent that needs the choice before the form is submitted (it still submits on its own).
  onChange?: (medium: PaymentMedium) => void;
}

export interface MediumOption {
  value: PaymentMedium;
  label: string;
}
