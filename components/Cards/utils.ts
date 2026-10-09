import { BRAND_NAMES, KIND_NAMES } from "@/core/cards/consts";
import type {
  CardLimitMode,
  CardLimitUsage,
  CardWithUsage,
} from "@/core/cards/types";
import { formatMoney, toDecimalString } from "@/core/incomes/money";

import {
  CURRENCIES_SEPARATOR,
  LIMIT_MODE_SUFFIXES,
  NO_ACTIVE_ACCOUNTS_LABEL,
  NO_VALUE_LABEL,
  cardTitle,
  dayLabel,
} from "./consts";
import type { CardLimitRow, CardRow } from "./types";

// The share of the cap that was used, 0..100. It stops at 100 when the cap is exceeded: the bar
// is full, and the tier says the rest.
const percentOf = (used: number, limit: number): number =>
  limit <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((used / limit) * 100)));

// One cap, in its own currency.
const toLimitRow = (
  usage: CardLimitUsage,
  limitMode: CardLimitMode,
): CardLimitRow => {
  const limit = formatMoney(usage.amount, usage.currency);

  return {
    currency: usage.currency,
    limitLabel: `${limit} ${LIMIT_MODE_SUFFIXES[limitMode]}`,
    usedLabel: `${formatMoney(usage.used, usage.currency)} de ${limit}`,
    availableLabel: formatMoney(usage.available, usage.currency),
    limitDecimal: toDecimalString(usage.amount, usage.currency),
    percent: percentOf(usage.used, usage.amount),
    tier: usage.tier,
  };
};

// Money and labels are formatted on the server so the client never re-derives presentation.
export const toCardRows = (cards: readonly CardWithUsage[]): CardRow[] =>
  cards.map((card) => {
    const brandName = BRAND_NAMES[card.brand];
    const identity = {
      id: card.id,
      kind: card.kind,
      bankId: card.bankId,
      bankName: card.bankName,
      last4: card.last4,
      brand: card.brand,
      title: cardTitle(brandName, card.last4),
      brandName,
      kindLabel: KIND_NAMES[card.kind],
    };

    if (card.kind === "DEBIT") {
      const currencies = card.accounts.map(({ currency }) => currency);

      return {
        ...identity,
        closingDay: null,
        dueDay: null,
        limitMode: null,
        closingLabel: NO_VALUE_LABEL,
        dueLabel: NO_VALUE_LABEL,
        limits: [],
        currenciesLabel:
          currencies.length > 0
            ? currencies.join(CURRENCIES_SEPARATOR)
            : NO_ACTIVE_ACCOUNTS_LABEL,
      };
    }

    return {
      ...identity,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      limitMode: card.limitMode,
      closingLabel: dayLabel(card.closingDay),
      dueLabel: dayLabel(card.dueDay),
      limits: card.usage.map((usage) => toLimitRow(usage, card.limitMode)),
      currenciesLabel: null,
    };
  });
