import { KIND_NAMES } from "@/core/cards/consts";

import type { KindOption } from "./types";

export const KIND_LABEL = "Tipo";

// The field name the form submits the kind under.
export const KIND_FIELD_NAME = "kind";

// In the order the radios appear.
export const KIND_OPTIONS: readonly KindOption[] = [
  {
    value: "CREDIT",
    label: KIND_NAMES.CREDIT,
    hint: "Se paga con el resumen, con un tope por moneda.",
  },
  {
    value: "DEBIT",
    label: KIND_NAMES.DEBIT,
    hint: "Descuenta en el momento de la cuenta de su banco en la moneda de la compra.",
  },
];
