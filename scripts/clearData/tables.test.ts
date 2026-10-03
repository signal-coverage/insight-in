import { describe, expect, it } from "vitest";
import { CLEAR_ORDER, buildCountQuery, buildDeleteQuery } from "./tables.ts";

// Foreign keys of prisma/schema.prisma: child -> parents it points at.
const PARENTS: Record<string, string[]> = {
  RecurringExpenseDecision: ["RecurringExpense"],
  Expense: ["ExpenseCategory", "RecurringExpense", "InstallmentPlan", "Card"],
  Income: ["IncomeCategory", "RecurringIncome", "InstallmentPlan", "Expense"],
  InstallmentPlan: ["ExpenseCategory", "IncomeCategory", "Card"],
  RecurringExpense: ["ExpenseCategory"],
  RecurringIncome: ["IncomeCategory"],
  Card: [],
  OpeningBalance: [],
  ExpenseCategory: [],
  IncomeCategory: [],
};

describe("CLEAR_ORDER", () => {
  it("lists every app table exactly once", () => {
    expect([...CLEAR_ORDER].sort()).toEqual(Object.keys(PARENTS).sort());
  });

  it("never lists _prisma_migrations", () => {
    expect(CLEAR_ORDER.join(" ")).not.toContain("_prisma_migrations");
  });

  it("deletes every child before the parents it references", () => {
    const order: readonly string[] = CLEAR_ORDER;
    for (const [child, parents] of Object.entries(PARENTS)) {
      for (const parent of parents) {
        expect(order.indexOf(child), `${child} before ${parent}`).toBeLessThan(
          order.indexOf(parent),
        );
      }
    }
  });
});

describe("buildDeleteQuery", () => {
  it("deletes every row of the table when there is no user", () => {
    expect(buildDeleteQuery("Expense", null)).toEqual({
      text: 'DELETE FROM "Expense"',
      values: [],
    });
  });

  it("scopes a table with a userId column through a parameter", () => {
    expect(buildDeleteQuery("Income", "user_1")).toEqual({
      text: 'DELETE FROM "Income" WHERE "userId" = $1',
      values: ["user_1"],
    });
  });

  it("scopes decisions through their template, which owns the userId", () => {
    expect(buildDeleteQuery("RecurringExpenseDecision", "user_1")).toEqual({
      text: 'DELETE FROM "RecurringExpenseDecision" WHERE "recurringExpenseId" IN (SELECT "id" FROM "RecurringExpense" WHERE "userId" = $1)',
      values: ["user_1"],
    });
  });

  it("never interpolates the user id into the SQL text", () => {
    const query = buildDeleteQuery("Card", 'x\'; DROP TABLE "Card"; --');
    expect(query.text).not.toContain("DROP");
    expect(query.values).toEqual(['x\'; DROP TABLE "Card"; --']);
  });
});

describe("buildCountQuery", () => {
  it("counts all rows, or only the user's ones", () => {
    expect(buildCountQuery("Card", null)).toEqual({
      text: 'SELECT COUNT(*) AS "count" FROM "Card"',
      values: [],
    });
    expect(buildCountQuery("Card", "user_1")).toEqual({
      text: 'SELECT COUNT(*) AS "count" FROM "Card" WHERE "userId" = $1',
      values: ["user_1"],
    });
  });

  it("scopes decisions through their template", () => {
    expect(
      buildCountQuery("RecurringExpenseDecision", "user_1").text,
    ).toContain('IN (SELECT "id" FROM "RecurringExpense" WHERE "userId" = $1)');
  });
});
