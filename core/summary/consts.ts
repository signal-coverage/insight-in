import type { AttentionKind, SideSummary } from "./types";

// A side of the budget with nothing on it.
export const EMPTY_SIDE: SideSummary = { total: 0, settled: 0, pending: 0 };

// How many months the income-against-expenses chart shows, ending with the month viewed.
export const CHART_MONTHS = 6;

// How many categories keep their own bar before the rest fold into "Otras".
export const CATEGORY_TOP_COUNT = 6;
export const OTHER_CATEGORIES_NAME = "Otras";
// Only for a category that could not be named (it never happens: categories cannot be deleted while
// they have expenses).
export const UNNAMED_CATEGORY_NAME = "Sin categoría";

// A planned expense this many days ahead (today included) already needs attention.
export const ATTENTION_DAYS_AHEAD = 7;

// The lines a group of the attention block shows; the rest are counted.
export const ATTENTION_ITEMS_PER_GROUP = 5;

// The groups of the attention block, the most urgent kind first.
export const ATTENTION_KIND_ORDER: readonly AttentionKind[] = [
  "overdueExpense",
  "negativeAccount",
  "cardLimit",
  "upcomingExpense",
  "overdueIncome",
  "reimbursement",
];
