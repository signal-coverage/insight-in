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
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
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
      amountUpdates: [],
    });
  });

  it("enables with the amount given, in the currency of the template", () => {
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

  it("rejects an invalid amount of a disabled template too, naming it", () => {
    for (const amount of ["abc", "0", "-5", "1.234"]) {
      expect(() =>
        plan(
          [item({ description: "Gym" })],
          [{ recurringExpenseId: "rec_1", choice: "disable", amount }],
        ),
      ).toThrow(InvalidRecurringAmountError);
    }
  });

  it("does not look at the amount of a template that is removed", () => {
    expect(
      plan(
        [item({ id: "b" })],
        [{ recurringExpenseId: "b", choice: "remove", amount: "abc" }],
      ),
    ).toEqual({
      enable: [],
      disable: [],
      remove: ["b"],
      amountUpdates: [],
    });
  });

  it("ignores ids that are not among the user's templates", () => {
    expect(
      plan([item()], [{ recurringExpenseId: "other", choice: "remove" }]),
    ).toEqual({ enable: [], disable: [], remove: [], amountUpdates: [] });
  });

  it("ignores templates that already have a decision for the month, amount included", () => {
    expect(
      plan(
        [item({ id: "a", decision: "ENABLED" }), item({ id: "b" })],
        [
          { recurringExpenseId: "a", choice: "remove" },
          { recurringExpenseId: "a", choice: "enable", amount: "abc" },
          { recurringExpenseId: "b", choice: "disable" },
        ],
      ),
    ).toEqual({ enable: [], disable: ["b"], remove: [], amountUpdates: [] });
    expect(
      plan(
        [item({ id: "a", decision: "DISABLED" })],
        [{ recurringExpenseId: "a", choice: "disable", amount: "999" }],
      ).amountUpdates,
    ).toEqual([]);
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
    ).toEqual({
      enable: [],
      disable: ["rec_1"],
      remove: [],
      amountUpdates: [],
    });
  });

  it("leaves templates without a choice untouched", () => {
    expect(
      plan(
        [item({ id: "a" }), item({ id: "b" })],
        [{ recurringExpenseId: "a", choice: "disable" }],
      ),
    ).toEqual({ enable: [], disable: ["a"], remove: [], amountUpdates: [] });
  });

  describe("an amount that differs from the template's", () => {
    it("is kept on the template when enabling, and used for the month's expense", () => {
      expect(
        plan(
          [item({ currency: "USD", amount: 4500 })],
          [{ recurringExpenseId: "rec_1", choice: "enable", amount: "52.5" }],
        ),
      ).toEqual({
        enable: [{ templateId: "rec_1", date: "2026-10-05", amount: 5250 }],
        disable: [],
        remove: [],
        amountUpdates: [{ templateId: "rec_1", amount: 5250 }],
      });
    });

    it("is kept on the template when disabling, with no expense created", () => {
      expect(
        plan(
          [item({ currency: "USD", amount: 4500 })],
          [{ recurringExpenseId: "rec_1", choice: "disable", amount: "52.5" }],
        ),
      ).toEqual({
        enable: [],
        disable: ["rec_1"],
        remove: [],
        amountUpdates: [{ templateId: "rec_1", amount: 5250 }],
      });
    });

    it("is ignored when removing, since the template is deleted", () => {
      expect(
        plan(
          [item({ amount: 4500 })],
          [{ recurringExpenseId: "rec_1", choice: "remove", amount: "52.5" }],
        ).amountUpdates,
      ).toEqual([]);
    });
  });

  describe("an amount equal to the template's", () => {
    it.each(["enable", "disable"] as const)(
      "writes nothing extra when %s",
      (choice) => {
        expect(
          plan(
            [item({ currency: "ARS", amount: 35000050 })],
            [{ recurringExpenseId: "rec_1", choice, amount: "350000.50" }],
          ).amountUpdates,
        ).toEqual([]);
      },
    );

    it("compares minor units, not text", () => {
      expect(
        plan(
          [item({ currency: "ARS", amount: 10000 })],
          [{ recurringExpenseId: "rec_1", choice: "disable", amount: "100" }],
        ).amountUpdates,
      ).toEqual([]);
    });
  });

  it("writes nothing extra when no amount comes with a disabled template", () => {
    expect(
      plan([item()], [{ recurringExpenseId: "rec_1", choice: "disable" }])
        .amountUpdates,
    ).toEqual([]);
  });

  it("collects one update per changed template, in request order", () => {
    expect(
      plan(
        [
          item({ id: "a", amount: 100 }),
          item({ id: "b", amount: 200 }),
          item({ id: "c", amount: 300 }),
        ],
        [
          { recurringExpenseId: "b", choice: "disable", amount: "5" },
          { recurringExpenseId: "a", choice: "enable", amount: "2" },
          { recurringExpenseId: "c", choice: "enable", amount: "3" },
        ],
      ).amountUpdates,
    ).toEqual([
      { templateId: "b", amount: 500 },
      { templateId: "a", amount: 200 },
    ]);
  });
});
