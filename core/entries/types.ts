// Per-currency totals over a filtered set. `settled` is the part already collected or paid; what
// is still pending is `total - settled`. Amounts in different currencies are never added.
export interface CurrencyTotal {
  currency: string;
  total: number;
  settled: number;
}

// What deleting several incomes or expenses at once answers: how many went away.
export type BulkDeleteResult =
  { status: "success"; deleted: number } | { status: "error"; message: string };
