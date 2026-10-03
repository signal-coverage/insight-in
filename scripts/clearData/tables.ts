/**
 * Every app table (prisma model names, no @@map), children before the parents they reference so
 * plain DELETEs never hit a Restrict foreign key:
 *   RecurringExpenseDecision -> RecurringExpense (Cascade)
 *   Income -> Expense (SetNull: the expense it pays back), so incomes go first
 *   Expense / Income -> categories (Restrict), templates and plans (SetNull), Card (SetNull)
 *   InstallmentPlan -> categories (Restrict), Card (SetNull)
 *   RecurringExpense / RecurringIncome -> categories (Restrict)
 * `_prisma_migrations` is deliberately absent: the schema and its history are never touched.
 */
export const CLEAR_ORDER = [
  "RecurringExpenseDecision",
  "Income",
  "Expense",
  "InstallmentPlan",
  "RecurringExpense",
  "RecurringIncome",
  "Card",
  "OpeningBalance",
  "ExpenseCategory",
  "IncomeCategory",
] as const;

export type ClearTable = (typeof CLEAR_ORDER)[number];

export type Query = { text: string; values: unknown[] };

// A decision has no userId of its own: it belongs to whoever owns its template.
function whereClause(table: ClearTable, userId: string | null): string {
  if (userId === null) return "";
  if (table === "RecurringExpenseDecision") {
    return ' WHERE "recurringExpenseId" IN (SELECT "id" FROM "RecurringExpense" WHERE "userId" = $1)';
  }
  return ' WHERE "userId" = $1';
}

export function buildDeleteQuery(
  table: ClearTable,
  userId: string | null,
): Query {
  return {
    text: `DELETE FROM "${table}"${whereClause(table, userId)}`,
    values: userId === null ? [] : [userId],
  };
}

export function buildCountQuery(
  table: ClearTable,
  userId: string | null,
): Query {
  return {
    text: `SELECT COUNT(*) AS "count" FROM "${table}"${whereClause(table, userId)}`,
    values: userId === null ? [] : [userId],
  };
}
