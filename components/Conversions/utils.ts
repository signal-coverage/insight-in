import type {
  ConversionItem,
  ConversionSide,
  Conversions,
  PairEvolution,
  PairSummary,
  RatePoint,
} from "@/core/conversions/types";
import { formatOrigin, formatRateMoney } from "@/core/currencies/origin";
import { DISPLAY_LOCALE } from "@/core/incomes/consts";
import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney } from "@/core/incomes/money";
import { formatMonth } from "@/core/summary/month";

import { NO_VARIATION, PAIR_CARD_IDS, RATE_LABELS, SIDE_COPY } from "./consts";
import type {
  ConversionsView,
  EvolutionView,
  ItemView,
  PairCard,
  PairCardId,
  PairView,
  RateView,
} from "./types";

// An income reads "USDC → ARS" (what was sent, then what arrived); an expense reads "ARS → USD"
// (what was paid, then what the price said): in both, the money that left the user comes first.
const pairName = (
  side: ConversionSide,
  originCurrency: string,
  netCurrency: string,
): string =>
  side === "income"
    ? `${originCurrency} → ${netCurrency}`
    : `${netCurrency} → ${originCurrency}`;

const toRateView = (point: RatePoint, netCurrency: string): RateView => ({
  rate: formatRateMoney(point.rate, netCurrency),
  date: formatIncomeDate(point.date),
});

const toItemView = (
  item: ConversionItem,
  originCurrency: string,
  netCurrency: string,
): ItemView => ({
  id: item.id,
  date: formatIncomeDate(item.date),
  description: item.description,
  origin: formatOrigin(item.originAmount, originCurrency),
  net: formatMoney(item.netAmount, netCurrency),
  rate: formatRateMoney(item.rate, netCurrency),
});

const toPairView = (pair: PairSummary): PairView => {
  const { side, originCurrency, netCurrency } = pair;

  return {
    id: pairName(side, originCurrency, netCurrency),
    side,
    originCurrency,
    count: String(pair.count),
    totalOrigin: formatOrigin(pair.totalOrigin, originCurrency),
    totalNet: formatMoney(pair.totalNet, netCurrency),
    averageRate: formatRateMoney(pair.averageRate, netCurrency),
    best: toRateView(pair.best, netCurrency),
    worst: toRateView(pair.worst, netCurrency),
    last: toRateView(pair.last, netCurrency),
    items: pair.items.map((item) =>
      toItemView(item, originCurrency, netCurrency),
    ),
  };
};

// "+12,7 %" / "-5,0 %": the sign is always there, so a rise and a fall read apart at a glance.
const formatVariation = (variation: number | null): string =>
  variation === null
    ? NO_VARIATION
    : `${new Intl.NumberFormat(DISPLAY_LOCALE, {
        signDisplay: "exceptZero",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(variation)} %`;

const toEvolutionView = ({
  side,
  originCurrency,
  netCurrency,
  points,
}: PairEvolution): EvolutionView => {
  const pair = pairName(side, originCurrency, netCurrency);

  return {
    id: `${side}:${pair}`,
    side,
    pair,
    rows: points.map(({ month, rate, variation }) => ({
      month: formatMonth(month),
      rate: formatRateMoney(rate, netCurrency),
      variation: formatVariation(variation),
    })),
  };
};

// Everything is formatted here, on the server, in each amount's own currency: the client only
// places text.
export const toConversionsView = ({
  incomes,
  expenses,
  evolution,
}: Conversions): ConversionsView => ({
  incomes: incomes.map(toPairView),
  expenses: expenses.map(toPairView),
  evolution: evolution.map(toEvolutionView),
});

// Whether the viewed month has any conversion at all (the evolution may still have data from the
// months before it).
export const hasMonthConversions = ({
  incomes,
  expenses,
}: ConversionsView): boolean => incomes.length > 0 || expenses.length > 0;

// What a card is called: the three amounts depend on the side, the rates do not.
export const cardLabel = (id: PairCardId, side: ConversionSide): string => {
  const copy = SIDE_COPY[side];

  switch (id) {
    case "count":
      return copy.countLabel;
    case "origin":
      return copy.originLabel;
    case "net":
      return copy.netLabel;
    default:
      return RATE_LABELS[id];
  }
};

// The labels of a side's cards, in order: what the placeholder shows while the figures load.
export const cardLabels = (side: ConversionSide): string[] =>
  PAIR_CARD_IDS.map((id) => cardLabel(id, side));

// The cards of a pair: how many conversions, what was sent and what arrived, then the rates (with
// the day the single ones happened).
export const pairCards = (pair: PairView): PairCard[] => {
  const values: Record<PairCardId, Pick<PairCard, "value" | "description">> = {
    count: { value: pair.count },
    origin: { value: pair.totalOrigin },
    net: { value: pair.totalNet },
    average: {
      value: pair.averageRate,
      description: `Por cada ${pair.originCurrency}, ponderada por monto`,
    },
    best: { value: pair.best.rate, description: pair.best.date },
    worst: { value: pair.worst.rate, description: pair.worst.date },
    last: { value: pair.last.rate, description: pair.last.date },
  };

  return PAIR_CARD_IDS.map((id) => ({
    id,
    label: cardLabel(id, pair.side),
    ...values[id],
  }));
};
