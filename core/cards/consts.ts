import type { CardBrand } from "./types";

export const CARDS_PATH = "/dashboard/cards";

export const CARD_BRANDS = ["VISA", "MASTERCARD", "OTHER"] as const;

// MONTHLY caps what is paid in a month; TOTAL caps what is committed in pending installments.
export const CARD_LIMIT_MODES = ["MONTHLY", "TOTAL"] as const;

export const CARD_FORM_FIELDS = [
  "last4",
  "brand",
  "closingDay",
  "dueDay",
  "currency",
  "limitMode",
  "limitAmount",
] as const;

export const MIN_CARD_DAY = 1;
export const MAX_CARD_DAY = 31;

// A card is "near" its cap once it uses more than this share of it.
export const NEAR_LIMIT_PERCENT = 80;

// A purchase that fits but leaves less than this share of the cap is flagged as close to it.
export const NEAR_MARGIN_PERCENT = 20;

// How each brand is written, in the table, the form and the messages.
export const BRAND_NAMES: Readonly<Record<CardBrand, string>> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  OTHER: "Otra",
};

export const CARD_NOT_FOUND_MESSAGE = "No se encontró la tarjeta.";
export const CARDS_NOT_FOUND_MESSAGE =
  "No se encontraron las tarjetas seleccionadas.";

export const CARD_HAS_PENDING_MESSAGE =
  "Esta tarjeta tiene gastos pendientes. Terminá de pagarlos o cambiá su tarjeta antes de eliminarla.";

export const CARD_CURRENCY_MISMATCH_MESSAGE =
  "La tarjeta tiene que estar en la misma moneda que la compra.";

export const duplicateCardMessage = (brand: CardBrand, last4: string): string =>
  `Ya tenés una tarjeta ${BRAND_NAMES[brand]} terminada en ${last4}.`;
