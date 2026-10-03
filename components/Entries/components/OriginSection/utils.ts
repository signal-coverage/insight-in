import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import type { OriginRateInput } from "@/components/Entries/types";
import { originRate } from "@/components/Entries/utils";
import { CRYPTO_CURRENCIES } from "@/core/currencies/consts";

import { RATE_LINE_LABEL } from "./consts";
import type { OriginCurrencyGroups } from "./types";

// The origin currencies on offer: the crypto assets first, then every ISO currency but the one of
// the net amount (an origin in the same currency would say nothing).
export const originCurrencyGroups = (
  netCurrency: string,
): OriginCurrencyGroups => ({
  crypto: CRYPTO_CURRENCIES.map(({ code, name }) => ({
    code,
    label: `${code} - ${name}`,
  })),
  fiat: CURRENCY_OPTIONS.filter(({ code }) => code !== netCurrency),
});

// "Cotización implícita: 1 USDC = $ 1.200,00" while both amounts are valid, nothing otherwise.
export const originRateLine = (input: OriginRateInput): string | null => {
  const rate = originRate(input);

  return rate === null ? null : `${RATE_LINE_LABEL}: ${rate}`;
};
