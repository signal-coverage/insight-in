import type {
  Card,
  CardCap,
  CardKind,
  CardLimit,
  CreditCard,
  DebitAccount,
  DebitCard,
} from "./types";

// Pure rules about the two kinds of card, shared by the services and the forms.

// Narrows any card-like value (a card, a card with its charges, a form's option) by its kind.
export const isCreditCard = <C extends { kind: CardKind }>(
  card: C,
): card is Extract<C, { kind: "CREDIT" }> => card.kind === "CREDIT";

export const isDebitCard = <C extends { kind: CardKind }>(
  card: C,
): card is Extract<C, { kind: "DEBIT" }> => card.kind === "DEBIT";

// The cap of a credit card in `currency`, if it has one.
export const limitIn = (
  card: Pick<CreditCard, "limits">,
  currency: string,
): CardLimit | null =>
  card.limits.find((limit) => limit.currency === currency) ?? null;

// The cap of a credit card in `currency` as the usage reads it. Never a sum of currencies.
export const capIn = (
  card: Pick<CreditCard, "limits" | "limitMode">,
  currency: string,
): CardCap | null => {
  const limit = limitIn(card, currency);

  return limit
    ? { currency, limitMode: card.limitMode, limitAmount: limit.amount }
    : null;
};

// The account a debit card spends from in `currency`: its bank's active one, if any.
export const debitAccountIn = (
  card: Pick<DebitCard, "accounts">,
  currency: string,
): DebitAccount | null =>
  card.accounts.find((account) => account.currency === currency) ?? null;

// The currencies a card can pay in: a credit card's caps, a debit card's accounts.
export const cardCurrencies = (card: Card): string[] =>
  card.kind === "CREDIT"
    ? card.limits.map(({ currency }) => currency)
    : card.accounts.map(({ currency }) => currency);
