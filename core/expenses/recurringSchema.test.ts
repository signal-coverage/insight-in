import { describe, expect, it } from "vitest";

import { MAX_RECURRING_DECISIONS } from "./consts";
import { recurringDecisionsSchema } from "./recurringSchema";

const parse = (value: unknown) => recurringDecisionsSchema.safeParse(value);

describe("recurringDecisionsSchema", () => {
  it("accepts the three choices", () => {
    const result = parse([
      { recurringExpenseId: "a", choice: "enable" },
      { recurringExpenseId: "b", choice: "disable" },
      { recurringExpenseId: "c", choice: "remove" },
    ]);

    expect(result.success && result.data.map((row) => row.choice)).toEqual([
      "enable",
      "disable",
      "remove",
    ]);
  });

  it("keeps the amount of an enabled row, trimmed", () => {
    const result = parse([
      { recurringExpenseId: "a", choice: "enable", amount: " 120.50 " },
    ]);

    expect(result.success && result.data[0].amount).toBe("120.50");
  });

  it("treats a blank amount as no amount, so the template amount is used", () => {
    const result = parse([
      { recurringExpenseId: "a", choice: "enable", amount: "  " },
    ]);

    expect(result.success && result.data[0]).toEqual({
      recurringExpenseId: "a",
      choice: "enable",
    });
  });

  it("drops the amount of a row that is not enabled", () => {
    const result = parse([
      { recurringExpenseId: "a", choice: "disable", amount: "10" },
      { recurringExpenseId: "b", choice: "remove", amount: "10" },
    ]);

    expect(result.success && result.data).toEqual([
      { recurringExpenseId: "a", choice: "disable" },
      { recurringExpenseId: "b", choice: "remove" },
    ]);
  });

  it("accepts an empty list", () => {
    expect(parse([]).success).toBe(true);
  });

  it.each([
    [
      "a choice that does not exist",
      [{ recurringExpenseId: "a", choice: "x" }],
    ],
    ["a missing id", [{ choice: "enable" }]],
    ["a blank id", [{ recurringExpenseId: " ", choice: "enable" }]],
    [
      "an amount that is not text",
      [{ recurringExpenseId: "a", choice: "enable", amount: 10 }],
    ],
    ["something that is not a list", { recurringExpenseId: "a" }],
  ])("rejects %s", (_name, value) => {
    expect(parse(value).success).toBe(false);
  });

  it("rejects more rows than a person could have", () => {
    const rows = Array.from(
      { length: MAX_RECURRING_DECISIONS + 1 },
      (_, i) => ({
        recurringExpenseId: `rec_${i}`,
        choice: "disable",
      }),
    );

    expect(parse(rows).success).toBe(false);
  });
});
