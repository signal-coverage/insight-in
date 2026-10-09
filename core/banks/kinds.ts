import {
  isLegalTenderCode,
  isSupportedCurrencyCode,
} from "@/core/incomes/money";

import type { BankKind } from "./types";

// An entity holds legal tender only; a virtual wallet also holds the crypto assets of the registry.
export const bankAcceptsCurrency = (
  kind: BankKind,
  currency: string,
): boolean =>
  kind === "WALLET"
    ? isSupportedCurrencyCode(currency)
    : isLegalTenderCode(currency);
