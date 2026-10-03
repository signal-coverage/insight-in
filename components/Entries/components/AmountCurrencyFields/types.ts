export interface AmountCurrencyFieldsProps {
  // The amount as typed.
  amount: string;
  // ISO 4217 code.
  currency: string;
  onChange: (patch: { amount?: string; currency?: string }) => void;
}
