// The words a section says: an income's origin and an expense's quoted price are the same mechanism
// with different copy.
export interface OriginSectionCopy {
  heading: string;
  hint: string;
  currencyLabel: string;
  amountLabel: string;
}

export interface OriginSectionProps {
  copy: OriginSectionCopy;
  // The amount that really moved as typed and its currency: the origin is a reference to them, and
  // the implied rate is net / origin.
  netAmount: string;
  netCurrency: string;
  // What the entry being edited already has as origin (a plain decimal for the amount).
  defaultCurrency: string | null;
  defaultAmount: string | null;
  // The server rejected the origin: the section opens so the error can be seen.
  hasErrors: boolean;
}

export interface OriginCurrencyOption {
  code: string;
  label: string;
}

export interface OriginCurrencyGroups {
  crypto: readonly OriginCurrencyOption[];
  fiat: readonly OriginCurrencyOption[];
}
