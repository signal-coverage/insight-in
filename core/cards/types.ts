import type { EntryStatus } from "@/core/entries/status";

import type { CARD_BRANDS, CARD_KINDS, CARD_LIMIT_MODES } from "./consts";

// The database enums have the same values.
export type CardBrand = (typeof CARD_BRANDS)[number];
export type CardLimitMode = (typeof CARD_LIMIT_MODES)[number];
export type CardKind = (typeof CARD_KINDS)[number];

// The cap of a credit card in one currency, in minor units of it. Caps in different currencies are
// never added together.
export interface CardLimit {
  currency: string;
  amount: number;
}

interface CardBaseInput {
  // The bank that issued the card: the user's. It never changes once the card exists.
  bankId: string;
  // Exactly 4 digits: the only part of the number that is ever stored.
  last4: string;
  brand: CardBrand;
}

export interface CreditCardInput extends CardBaseInput {
  kind: "CREDIT";
  // The day the statement closes, and the day it is paid (1..31).
  closingDay: number;
  dueDay: number;
  limitMode: CardLimitMode;
  // At least one, never two in the same currency, in currency order.
  limits: CardLimit[];
}

export interface DebitCardInput extends CardBaseInput {
  kind: "DEBIT";
}

// Validated card data, by kind.
export type CardInput = CreditCardInput | DebitCardInput;

// An active account of the bank of a debit card: the one it spends from in that currency.
export interface DebitAccount {
  id: string;
  currency: string;
  // "Banco · Cuenta".
  label: string;
}

interface CardIdentity {
  id: string;
  // The name of the bank, for the table and the forms.
  bankName: string;
}

export interface CreditCard extends CreditCardInput, CardIdentity {}

export interface DebitCard extends DebitCardInput, CardIdentity {
  // The bank's active accounts, one per currency (the oldest of a currency when there are several),
  // in the order of the Banks board. The card's currencies are theirs.
  accounts: DebitAccount[];
}

export type Card = CreditCard | DebitCard;

// One cap as the usage and the recommender read it: a currency, the card's mode and its amount there.
export interface CardCap {
  currency: string;
  limitMode: CardLimitMode;
  limitAmount: number;
}

// How close the card is to its cap: "available" up to 80% of it, "near" up to the cap itself and
// "exceeded" beyond it.
export type CardTier = "available" | "near" | "exceeded";

// A charge on the card, as the usage reads it: an installment of a purchase or a purchase in one
// payment, it makes no difference. A MONTHLY cap counts the PLANNED and the SETTLED ones of the month
// (a paid one was spent against the cap too); a TOTAL cap counts only the PLANNED ones (what is still
// owed). A COVERED one (paid by somebody else) never counts.
export interface CardCharge {
  // Minor units.
  amount: number;
  // "YYYY-MM-DD".
  date: string;
  currency: string;
  status: EntryStatus;
}

// What a card has used of one cap, in the currency of that cap.
export interface CardUsage {
  // Everything still to pay on the card, whatever month it falls in.
  committedTotal: number;
  // What the card was charged in the current month, paid or still to pay.
  monthUsed: number;
  // What counts against the cap, by the card's mode: the committed total (TOTAL) or the current
  // month's (MONTHLY).
  used: number;
  // The cap minus what was used. Negative when the cap is exceeded.
  available: number;
  tier: CardTier;
}

export interface CardLimitUsage extends CardLimit, CardUsage {}

// A card with what it has used of each of its caps (one per currency; none for a debit card).
export type CardWithUsage = Card & { usage: CardLimitUsage[] };

// A card with every charge made with it, which is all a projection of a new purchase needs.
export type CardWithCharges = Card & { charges: CardCharge[] };

export type CreditCardWithCharges = Extract<
  CardWithCharges,
  { kind: "CREDIT" }
>;

// A purchase the user is thinking about, as the card's cap sees it: the installments it will add and
// the month each one falls in.
export interface PurchaseProjection {
  currency: string;
  // Minor units: the sum of its installments.
  totalAmount: number;
  installments: readonly { month: string; amount: number }[];
}

// Whether a purchase fits a cap, and by how much. `margin` is what would be left of the cap after it
// (of the month with the least room, for a MONTHLY card); `excess` is how far over the cap it would go
// (in the month with the most excess). A cap in another currency never fits.
export type CardFit =
  | { fits: true; margin: number; month?: string }
  | { fits: false; reason: "currency" }
  | { fits: false; reason: "limit"; excess: number; month?: string };

// The purchase in installments the planner is working on, before any card is chosen: each card turns
// it into a projection with its own cycle.
export interface PurchaseDraft {
  currency: string;
  // Minor units.
  totalAmount: number;
  totalCuotas: number;
  // The day the purchase was made, "YYYY-MM-DD".
  purchaseDate: string;
}

// How a card suits a purchase: it fits with room to spare ("fits"), it fits but leaves less than a
// fifth of the cap ("near"), or it goes over the cap ("exceeded").
export type CardVerdict = "fits" | "near" | "exceeded";

export interface CardRecommendation {
  cardId: string;
  verdict: CardVerdict;
  // What is left of the cap after the purchase (of the tightest month on a MONTHLY card). Set when
  // the purchase fits.
  margin?: number;
  // How far over the cap the purchase goes. Set when it does not fit.
  excess?: number;
  // True for the best card that fits: the most room left, a tie going to the earlier closing day.
  recommended: boolean;
}

export type CardFieldErrors = Record<string, string[]>;

export type CardActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: CardFieldErrors };

// What deleting several cards at once answers: how many went away and how many were left out
// because they still have pending expenses (a card with something still to pay is never deleted).
export type CardsDeleteResult =
  | { status: "success"; deleted: number; skipped: number }
  | { status: "error"; message: string };
