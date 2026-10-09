import { compareCurrencyCodes } from "@/core/currencies/crypto";
import { impliedRate } from "@/core/currencies/origin";
import { monthOf, shiftMonth } from "@/core/summary/month";

import { EVOLUTION_MONTHS } from "./consts";
import type {
  ConversionEntry,
  ConversionItem,
  ConversionSide,
  EvolutionPoint,
  PairEvolution,
  PairSummary,
  RatePoint,
} from "./types";

interface RatedEntry {
  entry: ConversionEntry;
  rate: number;
}

interface Pair {
  originCurrency: string;
  netCurrency: string;
  rated: RatedEntry[];
}

// Only an entry with a rate can be told about: an unknown currency or an amount that is not
// positive has none, and leaves the statistics instead of poisoning them.
const toRated = (entry: ConversionEntry): RatedEntry[] => {
  const rate = impliedRate(
    entry.amount,
    entry.currency,
    entry.originAmount,
    entry.originCurrency,
  );

  return rate === null ? [] : [{ entry, rate }];
};

const byDateThenId = (a: RatedEntry, b: RatedEntry): number =>
  a.entry.date.localeCompare(b.entry.date) ||
  a.entry.id.localeCompare(b.entry.id);

// One group per (origin currency, net currency), each oldest first, in a stable order.
const groupByPair = (entries: readonly ConversionEntry[]): Pair[] => {
  const pairs = new Map<string, Pair>();

  for (const rated of entries.flatMap(toRated)) {
    const { originCurrency, currency } = rated.entry;
    const key = `${originCurrency}>${currency}`;
    const pair = pairs.get(key) ?? {
      originCurrency,
      netCurrency: currency,
      rated: [],
    };

    pair.rated.push(rated);
    pairs.set(key, pair);
  }

  return [...pairs.values()]
    .map((pair) => ({ ...pair, rated: [...pair.rated].sort(byDateThenId) }))
    .sort(
      (a, b) =>
        compareCurrencyCodes(a.originCurrency, b.originCurrency) ||
        compareCurrencyCodes(a.netCurrency, b.netCurrency),
    );
};

// The weighted rate: everything that arrived (or left) over everything that was sent (or priced).
// Pairs hold a single currency pair, so the sums are of one currency each.
const weighted = (pair: Pair, rated: readonly RatedEntry[]) => {
  const totalNet = rated.reduce((sum, { entry }) => sum + entry.amount, 0);
  const totalOrigin = rated.reduce(
    (sum, { entry }) => sum + entry.originAmount,
    0,
  );
  const rate = impliedRate(
    totalNet,
    pair.netCurrency,
    totalOrigin,
    pair.originCurrency,
  );

  return { totalNet, totalOrigin, rate: rate as number };
};

const toPoint = ({ entry, rate }: RatedEntry): RatePoint => ({
  rate,
  date: entry.date,
});

const toItem = ({ entry, rate }: RatedEntry): ConversionItem => ({
  id: entry.id,
  date: entry.date,
  description: entry.description,
  originAmount: entry.originAmount,
  netAmount: entry.amount,
  rate,
});

// The month's numbers per pair. What an income received is better the more net it got for each
// origin unit; what an expense paid is better the less it cost for each one, so "best" is the
// highest rate of an income and the lowest of an expense.
export const summarizePairs = (
  entries: readonly ConversionEntry[],
  side: ConversionSide,
  month: string,
): PairSummary[] =>
  groupByPair(entries.filter(({ date }) => monthOf(date) === month)).map(
    (pair) => {
      const { rated } = pair;
      const { totalNet, totalOrigin, rate } = weighted(pair, rated);
      const pick = (
        isBetter: (candidate: number, current: number) => boolean,
      ) =>
        rated.reduce((chosen, candidate) =>
          isBetter(candidate.rate, chosen.rate) ? candidate : chosen,
        );
      const highest = pick((candidate, current) => candidate > current);
      const lowest = pick((candidate, current) => candidate < current);

      return {
        side,
        originCurrency: pair.originCurrency,
        netCurrency: pair.netCurrency,
        count: rated.length,
        totalOrigin,
        totalNet,
        averageRate: rate,
        best: toPoint(side === "income" ? highest : lowest),
        worst: toPoint(side === "income" ? lowest : highest),
        last: toPoint(rated[rated.length - 1]),
        items: [...rated].reverse().map(toItem),
      };
    },
  );

// The months the evolution covers: `count` of them, the last one being the viewed month.
const windowMonths = (month: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    shiftMonth(month, index - (count - 1)),
  );

// Each pair's weighted rate in each month of the window that has data, oldest first. The variation
// compares a month with the one right before it, and stays empty when that one has no data: a gap
// would otherwise pass a two-month change off as a monthly one.
export const rateEvolution = (
  entries: readonly ConversionEntry[],
  side: ConversionSide,
  month: string,
  months: number = EVOLUTION_MONTHS,
): PairEvolution[] => {
  const window = windowMonths(month, months);
  const inWindow = entries.filter(({ date }) => window.includes(monthOf(date)));

  return groupByPair(inWindow).map((pair) => {
    const rates = new Map<string, number>();

    for (const key of window) {
      const rated = pair.rated.filter(
        ({ entry }) => monthOf(entry.date) === key,
      );

      if (rated.length > 0) {
        rates.set(key, weighted(pair, rated).rate);
      }
    }

    const points: EvolutionPoint[] = window.flatMap((key) => {
      const rate = rates.get(key);

      if (rate === undefined) {
        return [];
      }

      const previous = rates.get(shiftMonth(key, -1));

      return [
        {
          month: key,
          rate,
          variation:
            previous === undefined
              ? null
              : ((rate - previous) / previous) * 100,
        },
      ];
    });

    return {
      side,
      originCurrency: pair.originCurrency,
      netCurrency: pair.netCurrency,
      points,
    };
  });
};
