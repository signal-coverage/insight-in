import { describe, expect, it } from "vitest";

import type { RecurringRow } from "../../types";
import { toDecisions, withRowError } from "./utils";

const row = (id: string, amountDecimal = "100.00"): RecurringRow => ({
  id,
  description: id,
  amount: 10000,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 100,00",
  amountDecimal,
  dayLabel: "Día 5",
  originAmountDecimal: null,
  referenceLabel: null,
});

describe("toDecisions", () => {
  it("sends only the rows that got a choice", () => {
    expect(
      toDecisions([row("a"), row("b"), row("c")], { b: "disable" }, {}),
    ).toEqual([
      { recurringExpenseId: "b", choice: "disable", amount: "100.00" },
    ]);
  });

  it("keeps the order of the rows, not the order the choices were made in", () => {
    expect(
      toDecisions([row("a"), row("b")], { b: "remove", a: "disable" }, {}).map(
        (decision) => decision.recurringExpenseId,
      ),
    ).toEqual(["a", "b"]);
  });

  it("sends the amount typed with an enabled row", () => {
    expect(toDecisions([row("a")], { a: "enable" }, { a: "250.75" })).toEqual([
      { recurringExpenseId: "a", choice: "enable", amount: "250.75" },
    ]);
  });

  it("sends the amount typed with a disabled row too, so it sticks to the template", () => {
    expect(toDecisions([row("a")], { a: "disable" }, { a: "250.75" })).toEqual([
      { recurringExpenseId: "a", choice: "disable", amount: "250.75" },
    ]);
  });

  it.each(["enable", "disable"] as const)(
    "falls back to the template amount of a %s row when nothing was typed",
    (choice) => {
      expect(toDecisions([row("a", "99.90")], { a: choice }, {})).toEqual([
        { recurringExpenseId: "a", choice, amount: "99.90" },
      ]);
    },
  );

  it("sends no amount with a removed row, even if one was typed", () => {
    expect(toDecisions([row("b")], { b: "remove" }, { b: "6" })).toEqual([
      { recurringExpenseId: "b", choice: "remove" },
    ]);
  });

  it("ignores a choice for a row that is no longer listed", () => {
    expect(toDecisions([row("a")], { gone: "remove" }, {})).toEqual([]);
  });

  it("returns nothing when nothing was chosen", () => {
    expect(toDecisions([row("a")], {}, {})).toEqual([]);
  });
});

describe("withRowError", () => {
  it("sets the error of a row without touching the others", () => {
    expect(withRowError({ a: "one" }, "b", "two")).toEqual({
      a: "one",
      b: "two",
    });
  });

  it("replaces the error a row already had", () => {
    expect(withRowError({ a: "one" }, "a", "again")).toEqual({ a: "again" });
  });

  it("clears the error of a row with null", () => {
    expect(withRowError({ a: "one", b: "two" }, "a", null)).toEqual({
      b: "two",
    });
  });

  it("never mutates what it is given", () => {
    const errors = { a: "one" };

    withRowError(errors, "a", null);

    expect(errors).toEqual({ a: "one" });
  });
});
