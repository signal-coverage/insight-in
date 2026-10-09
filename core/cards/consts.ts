import type { CardBrand, CardKind } from "./types";

export const CARDS_PATH = "/dashboard/cards";

export const CARD_BRANDS = ["VISA", "MASTERCARD", "OTHER"] as const;

// MONTHLY caps what is paid in a month; TOTAL caps what is committed in pending installments.
export const CARD_LIMIT_MODES = ["MONTHLY", "TOTAL"] as const;

// CREDIT: bought now and paid with the statement, with a cap per currency. DEBIT covers prepaid cards
// too: it spends from an account of its bank.
export const CARD_KINDS = ["CREDIT", "DEBIT"] as const;

// What a new card starts as in the form.
export const DEFAULT_CARD_KIND: CardKind = "CREDIT";

// How each kind is written in the form, the table and the messages.
export const KIND_NAMES: Readonly<Record<CardKind, string>> = {
  CREDIT: "Crédito",
  DEBIT: "Débito o prepago",
};

// The single-value fields of the card form. The caps travel as repeated pairs (see formLimits.ts).
export const CARD_FORM_FIELDS = [
  "kind",
  "bankId",
  "last4",
  "brand",
  "closingDay",
  "dueDay",
  "limitMode",
] as const;

export const LIMIT_CURRENCY_FIELD = "limitCurrency";
export const LIMIT_AMOUNT_FIELD = "limitAmount";

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
  "La tarjeta no tiene un tope en la moneda de la compra.";

export const duplicateCardMessage = (brand: CardBrand, last4: string): string =>
  `Ya tenés una tarjeta ${BRAND_NAMES[brand]} terminada en ${last4}.`;

export const CARD_KIND_REQUIRED_MESSAGE = "Elegí el tipo de tarjeta.";
export const CARD_BANK_REQUIRED_MESSAGE = "Elegí el banco de la tarjeta.";
export const LIMITS_REQUIRED_MESSAGE = "Agregá al menos un tope.";
export const DUPLICATE_LIMIT_CURRENCY_MESSAGE = "Ya hay un tope en esa moneda.";
export const DEBIT_CREDIT_FIELDS_MESSAGE =
  "Una tarjeta de débito o prepaga no tiene cierre, vencimiento ni tope.";
export const CARD_KIND_LOCKED_MESSAGE =
  "El tipo de una tarjeta no se puede cambiar.";
export const CARD_BANK_LOCKED_MESSAGE =
  "El banco de una tarjeta no se puede cambiar.";
export const CARD_BANK_NOT_FOUND_MESSAGE = "Elegí un banco válido.";
export const CARD_BANK_ARCHIVED_MESSAGE =
  "Este banco está archivado. Elegí otro o reactivalo en Bancos.";
// Only a credit card can pay a purchase in installments.
export const CARD_KIND_NOT_ALLOWED_MESSAGE = "Elegí una tarjeta de crédito.";

export const cardBankWithoutAccountMessage = (currency: string): string =>
  `El banco de esta tarjeta no tiene una cuenta activa en ${currency}. Creá una en Bancos.`;
