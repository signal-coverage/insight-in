import { BANK_KIND_NAMES } from "@/core/banks/consts";

import type { KindOption } from "./types";

export const KIND_LABEL = "Tipo";

// The field name the form submits the kind under.
export const KIND_FIELD_NAME = "kind";

// In the order the radios appear.
export const KIND_OPTIONS: readonly KindOption[] = [
  {
    value: "ENTITY",
    label: BANK_KIND_NAMES.ENTITY,
    hint: "Un banco o el efectivo: solo monedas de curso legal (ARS, USD, EUR…).",
  },
  {
    value: "WALLET",
    label: BANK_KIND_NAMES.WALLET,
    hint: "Mercado Pago, AstroPay y similares: también criptomonedas (USDC, USDT, BTC…).",
  },
];
