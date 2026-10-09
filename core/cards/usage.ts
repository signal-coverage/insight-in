import { monthOf } from "@/core/summary/month";

import { NEAR_LIMIT_PERCENT } from "./consts";
import type {
  CardCap,
  CardCharge,
  CardFit,
  CardTier,
  CardUsage,
  PurchaseProjection,
} from "./types";

// What a card has committed and how that compares with its cap. Pure: it works on the charges it is
// given, which the service reads (installments and purchases in one payment alike). Amounts in
// different currencies are never added together, and a charge somebody else covered never counts.

const chargesIn = (
  charges: readonly CardCharge[],
  currency: string,
): CardCharge[] => charges.filter((charge) => charge.currency === currency);

const sum = (charges: readonly CardCharge[]): number =>
  charges.reduce((total, { amount }) => total + amount, 0);

// Everything still to pay on the card (the PLANNED charges), whatever month it falls in. A paid one
// no longer weighs on a TOTAL cap.
export const committedTotal = (
  charges: readonly CardCharge[],
  currency: string,
): number =>
  sum(
    chargesIn(charges, currency).filter(({ status }) => status === "PLANNED"),
  );

// What the card was charged in one month ("YYYY-MM"), still to pay or already paid: a paid charge
// was spent against a MONTHLY cap too.
export const monthUsed = (
  charges: readonly CardCharge[],
  currency: string,
  month: string,
): number =>
  sum(
    chargesIn(charges, currency).filter(
      ({ status, date }) =>
        (status === "PLANNED" || status === "SETTLED") &&
        monthOf(date) === month,
    ),
  );

// "available" while at most 80% of the cap is used, "near" above that up to the cap itself and
// "exceeded" beyond it. Compared in BigInt: an amount near the safe-integer limit times ten is not
// exact as a number.
export const tierOf = (used: number, limit: number): CardTier => {
  const usedBig = BigInt(used);
  const limitBig = BigInt(limit);

  if (usedBig * BigInt(100) <= limitBig * BigInt(NEAR_LIMIT_PERCENT)) {
    return "available";
  }

  return usedBig <= limitBig ? "near" : "exceeded";
};

// The usage of a card in `currentMonth`: a TOTAL card is measured by everything it has committed,
// a MONTHLY one by what falls in that month.
export const usageOf = (
  card: CardCap,
  charges: readonly CardCharge[],
  currentMonth: string,
): CardUsage => {
  const committed = committedTotal(charges, card.currency);
  const month = monthUsed(charges, card.currency, currentMonth);
  const used = card.limitMode === "TOTAL" ? committed : month;

  return {
    committedTotal: committed,
    monthUsed: month,
    used,
    available: card.limitAmount - used,
    tier: tierOf(used, card.limitAmount),
  };
};

// The projected installments of a purchase added up per month, earliest month first.
const addedPerMonth = (
  purchase: PurchaseProjection,
): { month: string; amount: number }[] => {
  const byMonth = new Map<string, number>();

  for (const { month, amount } of purchase.installments) {
    byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  }

  return [...byMonth]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

const toFit = (margin: number, month?: string): CardFit =>
  margin >= 0
    ? { fits: true, margin, ...(month && { month }) }
    : {
        fits: false,
        reason: "limit",
        excess: -margin,
        ...(month && { month }),
      };

// Whether a purchase fits the cap of a card, and by how much. A TOTAL card needs the whole purchase
// to fit in what it still has available. A MONTHLY card needs every month the purchase touches to
// stay within the cap, counting what the card already has in it; the answer is about the month with
// the least room. A cap in another currency than the purchase never fits.
export const fitOf = (
  card: CardCap,
  charges: readonly CardCharge[],
  purchase: PurchaseProjection,
): CardFit => {
  if (card.currency !== purchase.currency) {
    return { fits: false, reason: "currency" };
  }

  if (card.limitMode === "TOTAL") {
    return toFit(
      card.limitAmount -
        committedTotal(charges, card.currency) -
        purchase.totalAmount,
    );
  }

  const months = addedPerMonth(purchase);

  // Nothing to add: the cap is as untouched as it is.
  if (months.length === 0) {
    return toFit(card.limitAmount);
  }

  // The first month wins a tie, so the answer is the earliest tightest month.
  const tightest = months
    .map(({ month, amount }) => ({
      month,
      margin:
        card.limitAmount - monthUsed(charges, card.currency, month) - amount,
    }))
    .reduce((least, candidate) =>
      candidate.margin < least.margin ? candidate : least,
    );

  return toFit(tightest.margin, tightest.month);
};
