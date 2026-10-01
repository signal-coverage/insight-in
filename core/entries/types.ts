// Per-currency totals over a filtered set. `settled` is the part already collected or paid; what
// is still pending is `total - settled`. Amounts in different currencies are never added.
export interface CurrencyTotal {
  currency: string;
  total: number;
  settled: number;
}
