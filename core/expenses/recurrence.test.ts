import { describe, expect, it } from "vitest";

import { InvalidRecurringAmountError } from "./errors";
import {
  countPending,
  dateInMonth,
  dayOfMonthOf,
  planDecisions,
  splitByDecision,
} from "./recurrence";
import type { RecurringExpenseItem } from "./types";

const item = (
  patch: Partial<RecurringExpenseItem> = {},
): RecurringExpenseItem => ({
  id: "rec_1",
  description: "Rent",
  amount: 35000050,
  currency: "ARS",
  categoryId: "cat_1",
  categoryName: "Alquiler",
  notes: null,
  dayOfMonth: 5,
  decision: null,
  ...patch,
});

describe("dayOfMonthOf", () => {
  it("reads the day of a calendar date", () => {
    expect(dayOfMonthOf("2026-09-05")).toBe(5);
    expect(dayOfMonthOf("2026-01-31")).toBe(31);
  });
});

describe("dateInMonth", () => {
  it("puts the day in the month when the month has it", () => {
    expect(dateInMonth("2026-10", 5)).toBe("2026-10-05");
    expect(dateInMonth("2026-10", 31)).toBe("2026-10-31");
  });

  it("uses the last day of a shorter month", () => {
    expect(dateInMonth("2026-04", 31)).toBe("2026-04-30");
    expect(dateInMonth("2026-04", 30)).toBe("2026-04-30");
  });

  it("uses the 28th of February in a common year and the 29th in a leap year", () => {
    expect(dateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dateInMonth("2026-02", 29)).toBe("2026-02-28");
    expect(dateInMonth("2028-02", 30)).toBe("2028-02-29");
    expect(dateInMonth("2028-02", 29)).toBe("2028-02-29");
  });

  it("treats a century year that is not divisible by 400 as common", () => {
    expect(dateInMonth("2100-02", 29)).toBe("2100-02-28");
  });
});

describe("splitByDecision", () => {
  it("separates the templates still waiting for a decision from the decided ones", () => {
    const waiting = item({ id: "a" });
    const enabled = item({ id: "b", decision: "ENABLED" });
    const disabled = item({ id: "c", decision: "DISABLED" });

    expect(splitByDecision([waiting, enabled, disabled])).toEqual({
      pending: [waiting],
      decided: [enabled, disabled],
    });
  });

  it("orders each side by day of month and then by description", () => {
    const late = item({ id: "a", dayOfMonth: 20, description: "Gym" });
    const earlyB = item({ id: "b", dayOfMonth: 3, description: "Water" });
    const earlyA = item({ id: "c", dayOfMonth: 3, description: "Electricity" });

    expect(
      splitByDecision([late, earlyB, earlyA]).pending.map(({ id }) => id),
    ).toEqual(["c", "b", "a"]);
  });

  it("returns nothing for nothing", () => {
    expect(splitByDecision([])).toEqual({ pending: [], decided: [] });
  });
});

describe("countPending", () => {
  it("counts only the templates without a decision", () => {
    expect(
      countPending([
        item({ id: "a" }),
        item({ id: "b", decision: "ENABLED" }),
        item({ id: "c" }),
      ]),
    ).toBe(2);
  });
});

describe("planDecisions", () => {
  const plan = (
    templates: RecurringExpenseItem[],
    requested: Parameters<typeof planDecisions>[0]["requested"],
    month = "2026-10",
  ) => planDecisions({ templates, requested, month });

  it("enables with the template amount and its day of the month by default", () => {
    expect(
      plan([item()], [{ recurringExpenseId: "rec_1", choice: "enable" }]),
    ).toEqual({
      enable: [{ templateId: "rec_1", date: "2026-10-05", amount: 35000050 }],
      disable: [],
      remove: [],
    });
  });

  it("enables with the amount given for this month, in the currency of the template", () => {
    const { enable } = plan(
      [item({ currency: "USD" })],
      [{ recurringExpenseId: "rec_1", choice: "enable", amount: "120.5" }],
    );

    expect(enable[0].amount).toBe(12050);
  });

  it("clamps the day to the end of a shorter month", () => {
    const { enable } = plan(
      [item({ dayOfMonth: 31 })],
      [{ recurringExpenseId: "rec_1", choice: "enable" }],
      "2026-02",
    );

    expect(enable[0].date).toBe("2026-02-28");
  });

  it("rejects an amount that is not valid for the currency, naming the template", () => {
    expect(() =>
      plan(
        [item({ description: "Rent" })],
        [{ recurringExpenseId: "rec_1", choice: "enable", amount: "abc" }],
      ),
    ).toThrow(InvalidRecurringAmountError);
    expect(() =>
      plan(
        [item({ description: "Rent" })],
        [{ recurringExpenseId: "rec_1", choice: "enable", amount: "0" }],
      ),
    ).toThrow(InvalidRecurringAmountError);
    expect(() =>
      plan(
        [item({ currency: "ARS" })],
        [{ recurringExpenseId: "rec_1", choice: "enable", amount: "1.234" }],
      ),
    ).toThrow(InvalidRecurringAmountError);
  });

  it("does not look at the amount of a template that is disabled or removed", () => {
    expect(
      plan(
        [item({ id: "a" }), item({ id: "b" })],
        [
          { recurringExpenseId: "a", choice: "disable", amount: "abc" },
          { recurringExpenseId: "b", choice: "remove", amount: "abc" },
        ],
      ),
    ).toEqual({ enable: [], disable: ["a"], remove: ["b"] });
  });

  it("ignores ids that are not among the user's templates", () => {
    expect(
      plan([item()], [{ recurringExpenseId: "other", choice: "remove" }]),
    ).toEqual({ enable: [], disable: [], remove: [] });
  });

  it("ignores templates that already have a decision for the month", () => {
    expect(
      plan(
        [item({ id: "a", decision: "ENABLED" }), item({ id: "b" })],
        [
          { recurringExpenseId: "a", choice: "remove" },
          { recurringExpenseId: "b", choice: "disable" },
        ],
      ),
    ).toEqual({ enable: [], disable: ["b"], remove: [] });
  });

  it("keeps only the first choice for a template that is listed twice", () => {
    expect(
      plan(
        [item()],
        [
          { recurringExpenseId: "rec_1", choice: "disable" },
          { recurringExpenseId: "rec_1", choice: "remove" },
        ],
      ),
    ).toEqual({ enable: [], disable: ["rec_1"], remove: [] });
  });

  it("leaves templates without a choice untouched", () => {
    expect(
      plan(
        [item({ id: "a" }), item({ id: "b" })],
        [{ recurringExpenseId: "a", choice: "disable" }],
      ),
    ).toEqual({ enable: [], disable: ["a"], remove: [] });
  });
});
