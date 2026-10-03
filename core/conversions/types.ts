// Which side of the budget a conversion belongs to: an income whose net amount came from another
// currency, or an expense that was priced in another currency.
export type ConversionSide = "income" | "expense";

// One income or expense carrying an origin, in minor units (the net amount in its own currency, the
// origin amount in the origin currency's).
export interface ConversionEntry {
  id: string;
  // "YYYY-MM-DD".
  date: string;
  description: string;
  // The net currency: what actually arrived or left the user's money.
  currency: string;
  amount: number;
  originCurrency: string;
  originAmount: number;
}

// One conversion of the month, with the rate it implies (net units per origin unit).
export interface ConversionItem {
  id: string;
  date: string;
  description: string;
  originAmount: number;
  netAmount: number;
  rate: number;
}

export interface RatePoint {
  rate: number;
  // "YYYY-MM-DD".
  date: string;
}

// Everything the month says about one (origin currency, net currency) pair of one side. Pairs are
// never added together: each one has its own amounts, in its own currencies.
export interface PairSummary {
  side: ConversionSide;
  originCurrency: string;
  netCurrency: string;
  count: number;
  totalOrigin: number;
  totalNet: number;
  // Total net over total origin: weighted by amount, not the mean of the rates.
  averageRate: number;
  // The most and the least favourable single rate of the month, for the side.
  best: RatePoint;
  worst: RatePoint;
  // The rate of the latest conversion of the month.
  last: RatePoint;
  // Newest first.
  items: ConversionItem[];
}

export interface EvolutionPoint {
  // "YYYY-MM".
  month: string;
  // The month's weighted average rate.
  rate: number;
  // Percentage change against the month right before, or null when that month has no data.
  variation: number | null;
}

// A pair's weighted rate month by month (oldest first), only for the months that have data.
export interface PairEvolution {
  side: ConversionSide;
  originCurrency: string;
  netCurrency: string;
  points: EvolutionPoint[];
}

export interface Conversions {
  incomes: PairSummary[];
  expenses: PairSummary[];
  evolution: PairEvolution[];
}
