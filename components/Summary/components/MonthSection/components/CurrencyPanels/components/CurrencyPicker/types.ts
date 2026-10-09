export interface CurrencyPickerProps {
  // Every currency the user has, in the tabs' order (hiding aside).
  currencies: readonly string[];
  // The currencies the user chose to hide, as saved. May hold codes the user no longer has.
  hidden: readonly string[];
}
