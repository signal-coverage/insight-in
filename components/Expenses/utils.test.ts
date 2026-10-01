import { describe, expect, it } from "vitest";

import type { RecurringExpenseItem } from "@/core/expenses/types";

import { toExpenseRows, toRecurringData } from "./utils";

const EXPENSE = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  status: "SETTLED" as const,
  isRecurring: true,
};

describe("toExpenseRows", () => {
  it("adds the formatted amount, the decimal amount for the form and the formatted date", () => {
    const [row] = toExpenseRows([EXPENSE]);

    expect(row).toMatchObject({
      ...EXPENSE,
      amountDecimal: "350000.50",
      dateLabel: "5 sept 2026",
    });
    expect(row.amountLabel).toMatch(/^\$\s350\.000,50$/);
  });

  it("keeps the order it is given", () => {
    const rows = toExpenseRows([EXPENSE, { ...EXPENSE, id: "exp_2" }]);

    expect(rows.map((row) => row.id)).toEqual(["exp_1", "exp_2"]);
  });

  it("returns nothing for nothing", () => {
    expect(toExpenseRows([])).toEqual([]);
  });
});

const TEMPLATE: RecurringExpenseItem = {
  id: "rec_1",
  description: "Rent",
  amount: 35000050,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  dayOfMonth: 5,
  decision: null,
};

describe("toRecurringData", () => {
  it("names the month the templates are resolved for", () => {
    expect(toRecurringData({ month: "2026-10", items: [] })).toMatchObject({
      month: "2026-10",
      monthLabel: "Octubre de 2026",
    });
  });

  it("adds the formatted amount, the decimal amount for the input and the day", () => {
    const { pending } = toRecurringData({
      month: "2026-10",
      items: [TEMPLATE],
    });

    expect(pending[0]).toMatchObject({
      ...TEMPLATE,
      amountDecimal: "350000.50",
      dayLabel: "Día 5",
    });
    expect(pending[0].amountLabel).toMatch(/^\$\s350\.000,50$/);
  });

  it("lists the templates without a decision first and apart from the decided ones", () => {
    const decided = { ...TEMPLATE, id: "rec_2", decision: "ENABLED" as const };
    const { pending, decided: done } = toRecurringData({
      month: "2026-10",
      items: [decided, TEMPLATE],
    });

    expect(pending.map(({ id }) => id)).toEqual(["rec_1"]);
    expect(done.map(({ id }) => id)).toEqual(["rec_2"]);
  });

  it("counts how many are still waiting", () => {
    const decided = { ...TEMPLATE, id: "rec_2", decision: "DISABLED" as const };

    expect(
      toRecurringData({
        month: "2026-10",
        items: [TEMPLATE, { ...TEMPLATE, id: "rec_3" }, decided],
      }).pendingCount,
    ).toBe(2);
  });
});
