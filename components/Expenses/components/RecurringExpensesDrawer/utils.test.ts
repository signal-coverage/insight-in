import { describe, expect, it } from "vitest";

import type { RecurringRow } from "../../types";
import { toDecisions } from "./utils";

const row = (id: string, amountDecimal = "100.00"): RecurringRow => ({
  id,
  description: id,
  amount: 10000,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 100,00",
  amountDecimal,
  dayLabel: "Día 5",
});

describe("toDecisions", () => {
  it("sends only the rows that got a choice", () => {
    expect(
      toDecisions([row("a"), row("b"), row("c")], { b: "disable" }, {}),
    ).toEqual([{ recurringExpenseId: "b", choice: "disable" }]);
  });

  it("keeps the order of the rows, not the order the choices were made in", () => {
    expect(
      toDecisions([row("a"), row("b")], { b: "remove", a: "disable" }, {}).map(
        (decision) => decision.recurringExpenseId,
      ),
    ).toEqual(["a", "b"]);
  });

  it("sends the amount typed for this month with an enabled row", () => {
    expect(toDecisions([row("a")], { a: "enable" }, { a: "250.75" })).toEqual([
      { recurringExpenseId: "a", choice: "enable", amount: "250.75" },
    ]);
  });

  it("falls back to the template amount when nothing was typed", () => {
    expect(toDecisions([row("a", "99.90")], { a: "enable" }, {})).toEqual([
      { recurringExpenseId: "a", choice: "enable", amount: "99.90" },
    ]);
  });

  it("sends no amount with a row that is disabled or removed, even if one was typed", () => {
    expect(
      toDecisions(
        [row("a"), row("b")],
        { a: "disable", b: "remove" },
        { a: "5", b: "6" },
      ),
    ).toEqual([
      { recurringExpenseId: "a", choice: "disable" },
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
