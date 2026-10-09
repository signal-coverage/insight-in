import {
  CRYPTO_CURRENCY_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/components/Entries/currencyOptions";
import { visibleTabs } from "@/core/summary/tabs";

const LABELS = new Map(
  [...CURRENCY_OPTIONS, ...CRYPTO_CURRENCY_OPTIONS].map(({ code, label }) => [
    code,
    label,
  ]),
);

// "USD - dólar estadounidense": the code and the name, or the bare code when the app has no name.
export const currencyLabel = (code: string): string => LABELS.get(code) ?? code;

// The currencies that show as tabs: the same rule the tabs follow, so the boxes always match them.
export const checkedCurrencies = (
  currencies: readonly string[],
  hidden: readonly string[],
): string[] =>
  visibleTabs(
    currencies.map((currency) => ({ currency })),
    hidden,
  ).map(({ currency }) => currency);

// The list to save after one box changes: every currency the user has and left unticked, plus the
// codes already hidden that the user does not have (they stay hidden if the currency comes back).
export const nextHidden = (
  currencies: readonly string[],
  hidden: readonly string[],
  code: string,
  isChecked: boolean,
): string[] => {
  const checked = new Set(checkedCurrencies(currencies, hidden));

  if (isChecked) checked.add(code);
  else checked.delete(code);

  return [
    ...hidden.filter((each) => !currencies.includes(each)),
    ...currencies.filter((each) => !checked.has(each)),
  ];
};
