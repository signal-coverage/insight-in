import { installmentDates, splitAmount } from "@/core/installments/plan";
import { monthOf } from "@/core/summary/month";

import { NEAR_MARGIN_PERCENT } from "./consts";
import { firstInstallmentDate } from "./cycle";
import { capIn, isCreditCard } from "./kinds";
import type {
  CardCap,
  CardRecommendation,
  CardWithCharges,
  CreditCard,
  CreditCardWithCharges,
  PurchaseDraft,
  PurchaseProjection,
} from "./types";
import { fitOf } from "./usage";

// Which of the user's cards suits a purchase in installments. Pure: it works on the cards and the
// charges it is given, so the planner can recommend live while the user types.

type CycleOf = Pick<CreditCard, "closingDay" | "dueDay">;

// The purchase as one card sees it: its first installment is paid on the due date of the statement
// the purchase lands in, which depends on the card's own cycle, and one more every month after.
export const projectionOf = (
  card: CycleOf,
  { currency, totalAmount, totalCuotas, purchaseDate }: PurchaseDraft,
): PurchaseProjection => {
  const firstDate = firstInstallmentDate(
    purchaseDate,
    card.closingDay,
    card.dueDay,
  );
  const amounts = splitAmount(totalAmount, totalCuotas);

  return {
    currency,
    totalAmount,
    installments: installmentDates(firstDate, totalCuotas).map(
      (date, index) => ({ month: monthOf(date), amount: amounts[index] }),
    ),
  };
};

// Whether what is left of the cap is less than NEAR_MARGIN_PERCENT of it. Compared in BigInt so a
// huge cap does not lose precision.
const isTight = (margin: number, limit: number): boolean =>
  BigInt(margin) * BigInt(100) < BigInt(limit) * BigInt(NEAR_MARGIN_PERCENT);

const verdictOf = (
  card: CreditCardWithCharges,
  cap: CardCap,
  purchase: PurchaseDraft,
): Omit<CardRecommendation, "recommended"> => {
  const fit = fitOf(cap, card.charges, projectionOf(card, purchase));

  if (fit.fits) {
    return {
      cardId: card.id,
      verdict: isTight(fit.margin, cap.limitAmount) ? "near" : "fits",
      margin: fit.margin,
    };
  }

  // The cap is in the currency of the purchase (the others were left out), so a failure can only be
  // about the cap.
  return {
    cardId: card.id,
    verdict: "exceeded",
    excess: fit.reason === "limit" ? fit.excess : 0,
  };
};

// The credit cards with a cap in the currency of the purchase, with a verdict each against that cap
// (a debit card is paid on the spot, so it is never one of them): it fits, it fits but leaves less
// than a fifth of the cap, or it goes over the cap. The ones that fit come first, the one with the
// most room on top (a tie goes to the card that closes earlier), then the ones that do not, the least
// over first. The top card, when it fits, is the recommended one.
export const recommendCards = (
  cards: readonly CardWithCharges[],
  purchase: PurchaseDraft,
): CardRecommendation[] => {
  const credit = cards.filter(isCreditCard);
  const closingOf = new Map(
    credit.map(({ id, closingDay }) => [id, closingDay]),
  );
  const verdicts = credit.flatMap((card) => {
    const cap = capIn(card, purchase.currency);

    return cap ? [verdictOf(card, cap, purchase)] : [];
  });

  const byRoom = (a: CardRecommendation, b: CardRecommendation): number => {
    if (a.verdict === "exceeded" || b.verdict === "exceeded") {
      if (a.verdict !== b.verdict) {
        return a.verdict === "exceeded" ? 1 : -1;
      }

      return (a.excess ?? 0) - (b.excess ?? 0);
    }

    return (
      (b.margin ?? 0) - (a.margin ?? 0) ||
      (closingOf.get(a.cardId) ?? 0) - (closingOf.get(b.cardId) ?? 0)
    );
  };

  const sorted = verdicts
    .map((verdict) => ({ ...verdict, recommended: false }))
    .sort(byRoom);

  if (sorted.length > 0 && sorted[0].verdict !== "exceeded") {
    sorted[0].recommended = true;
  }

  return sorted;
};
