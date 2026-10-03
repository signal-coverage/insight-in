import { BRAND_NAMES } from "@/core/cards/consts";
import type { CardWithUsage } from "@/core/cards/types";
import { formatMoney, toDecimalString } from "@/core/incomes/money";

import { cardTitle, dayLabel, LIMIT_MODE_SUFFIXES } from "./consts";
import type { CardRow } from "./types";

// The share of the cap that was used, 0..100. It stops at 100 when the cap is exceeded: the bar
// is full, and the tier says the rest.
const percentOf = (used: number, limit: number): number =>
  limit <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((used / limit) * 100)));

// Money and labels are formatted on the server so the client never re-derives presentation.
export const toCardRows = (cards: readonly CardWithUsage[]): CardRow[] =>
  cards.map((card) => {
    const brandName = BRAND_NAMES[card.brand];
    const limit = formatMoney(card.limitAmount, card.currency);

    return {
      ...card,
      title: cardTitle(brandName, card.last4),
      brandName,
      closingLabel: dayLabel(card.closingDay),
      dueLabel: dayLabel(card.dueDay),
      limitLabel: `${limit} ${LIMIT_MODE_SUFFIXES[card.limitMode]}`,
      usedLabel: `${formatMoney(card.used, card.currency)} de ${limit}`,
      availableLabel: formatMoney(card.available, card.currency),
      limitDecimal: toDecimalString(card.limitAmount, card.currency),
      percent: percentOf(card.used, card.limitAmount),
    };
  });
