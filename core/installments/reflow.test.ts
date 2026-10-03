import { describe, expect, it } from "vitest";

import { countInMonth, pendingCount, planCounts, reflowPlan } from "./reflow";
import type { InstallmentRow, PlanForReflow } from "./types";

const row = (
  number: number,
  date: string,
  status: InstallmentRow["status"] = "PLANNED",
): InstallmentRow => ({ id: `exp_${number}`, number, date, status });

// 12 installments on the 5th, from October: #1 is paid, the rest are pending.
const twelve = (): InstallmentRow[] =>
  Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const monthIndex = 9 + index;
    const year = 2026 + Math.floor(monthIndex / 12);
    const month = String((monthIndex % 12) + 1).padStart(2, "0");

    return row(
      number,
      `${year}-${month}-05`,
      number === 1 ? "SETTLED" : "PLANNED",
    );
  });

const datesOf = (moves: { id: string; date: string }[]) =>
  Object.fromEntries(moves.map(({ id, date }) => [id, date]));

describe("reflowPlan", () => {
  it("lays out k installments in the month and the rest one per month after it", () => {
    // October: #1 is paid. In November the user chooses 2: #2 and #3 are due in November.
    const moves = reflowPlan({
      installments: twelve(),
      dayOfMonth: 5,
      month: "2026-11",
      count: 2,
    });

    expect(datesOf(moves!)).toEqual({
      exp_3: "2026-11-05",
      exp_4: "2026-12-05",
      exp_5: "2027-01-05",
      exp_6: "2027-02-05",
      exp_7: "2027-03-05",
      exp_8: "2027-04-05",
      exp_9: "2027-05-05",
      exp_10: "2027-06-05",
      exp_11: "2027-07-05",
      exp_12: "2027-08-05",
    });
  });

  it("writes only the rows whose date changes", () => {
    const moves = reflowPlan({
      installments: twelve(),
      dayOfMonth: 5,
      month: "2026-11",
      count: 2,
    });

    // #2 already is in November, and #1 is paid.
    expect(moves!.map(({ id }) => id)).not.toContain("exp_2");
    expect(moves!.map(({ id }) => id)).not.toContain("exp_1");
  });

  it("with the usual single installment this month writes nothing for an already-correct layout", () => {
    expect(
      reflowPlan({
        installments: twelve(),
        dayOfMonth: 5,
        month: "2026-11",
        count: 1,
      }),
    ).toEqual([]);
  });

  it("writes nothing when the same count is applied twice", () => {
    const installments = twelve();
    const first = reflowPlan({
      installments,
      dayOfMonth: 5,
      month: "2026-11",
      count: 3,
    })!;
    const moved = installments.map((item) => ({
      ...item,
      date: datesOf(first)[item.id] ?? item.date,
    }));

    expect(
      reflowPlan({
        installments: moved,
        dayOfMonth: 5,
        month: "2026-11",
        count: 3,
      }),
    ).toEqual([]);
  });

  it("with k = 0 pushes every pending installment one month back, starting next month", () => {
    const moves = reflowPlan({
      installments: twelve(),
      dayOfMonth: 5,
      month: "2026-11",
      count: 0,
    });

    expect(datesOf(moves!)).toEqual({
      exp_2: "2026-12-05",
      exp_3: "2027-01-05",
      exp_4: "2027-02-05",
      exp_5: "2027-03-05",
      exp_6: "2027-04-05",
      exp_7: "2027-05-05",
      exp_8: "2027-06-05",
      exp_9: "2027-07-05",
      exp_10: "2027-08-05",
      exp_11: "2027-09-05",
      exp_12: "2027-10-05",
    });
  });

  it("with k equal to the pending installments puts them all in the month", () => {
    const installments = [
      row(1, "2026-10-05", "SETTLED"),
      row(2, "2026-11-05"),
      row(3, "2026-12-05"),
    ];

    expect(
      datesOf(
        reflowPlan({
          installments,
          dayOfMonth: 5,
          month: "2026-11",
          count: 2,
        })!,
      ),
    ).toEqual({ exp_3: "2026-11-05" });
  });

  it("is invalid with more installments than are pending", () => {
    expect(
      reflowPlan({
        installments: [row(1, "2026-10-05", "SETTLED"), row(2, "2026-11-05")],
        dayOfMonth: 5,
        month: "2026-11",
        count: 2,
      }),
    ).toBeNull();
  });

  it("is invalid for a negative or fractional count", () => {
    const installments = twelve();

    expect(
      reflowPlan({ installments, dayOfMonth: 5, month: "2026-11", count: -1 }),
    ).toBeNull();
    expect(
      reflowPlan({ installments, dayOfMonth: 5, month: "2026-11", count: 1.5 }),
    ).toBeNull();
  });

  it("never moves an installment that is paid or covered, and numbers the pending ones in order", () => {
    const installments = [
      row(1, "2026-09-05", "SETTLED"),
      row(2, "2026-10-05", "COVERED"),
      row(3, "2026-11-05"),
      row(4, "2026-12-05"),
      row(5, "2027-01-05"),
    ];

    const moves = reflowPlan({
      installments,
      dayOfMonth: 5,
      month: "2026-11",
      count: 0,
    })!;

    expect(datesOf(moves)).toEqual({
      exp_3: "2026-12-05",
      exp_4: "2027-01-05",
      exp_5: "2027-02-05",
    });
  });

  it("lays the pending ones out by installment number whatever the order they come in", () => {
    const installments = [row(4, "2026-12-05"), row(3, "2026-11-05")];

    expect(
      datesOf(
        reflowPlan({
          installments,
          dayOfMonth: 5,
          month: "2026-11",
          count: 0,
        })!,
      ),
    ).toEqual({ exp_3: "2026-12-05", exp_4: "2027-01-05" });
  });

  it("brings an overdue pending installment into the month", () => {
    const installments = [
      row(3, "2026-09-05"),
      row(4, "2026-10-05"),
      row(5, "2026-11-05"),
    ];

    expect(
      datesOf(
        reflowPlan({
          installments,
          dayOfMonth: 5,
          month: "2026-11",
          count: 1,
        })!,
      ),
    ).toEqual({
      exp_3: "2026-11-05",
      exp_4: "2026-12-05",
      exp_5: "2027-01-05",
    });
  });

  it("clamps the day to the last day of a shorter month and goes back to it afterwards", () => {
    const installments = [
      row(2, "2027-01-31"),
      row(3, "2027-02-28"),
      row(4, "2027-03-31"),
    ];

    expect(
      datesOf(
        reflowPlan({
          installments,
          dayOfMonth: 31,
          month: "2027-01",
          count: 0,
        })!,
      ),
    ).toEqual({
      exp_2: "2027-02-28",
      exp_3: "2027-03-31",
      exp_4: "2027-04-30",
    });
  });

  it("changes nothing but dates", () => {
    const [move] = reflowPlan({
      installments: [row(2, "2026-11-05")],
      dayOfMonth: 5,
      month: "2026-11",
      count: 0,
    })!;

    expect(Object.keys(move).sort()).toEqual(["date", "id"]);
  });

  it("has nothing to do for a plan with nothing pending when no installment is asked", () => {
    expect(
      reflowPlan({
        installments: [row(1, "2026-10-05", "SETTLED")],
        dayOfMonth: 5,
        month: "2026-11",
        count: 0,
      }),
    ).toEqual([]);
  });
});

describe("pendingCount", () => {
  it("counts only the installments still to pay", () => {
    expect(
      pendingCount([
        row(1, "2026-10-05", "SETTLED"),
        row(2, "2026-11-05", "COVERED"),
        row(3, "2026-12-05"),
        row(4, "2027-01-05"),
      ]),
    ).toBe(2);
  });
});

describe("countInMonth", () => {
  it("counts the pending installments already dated in the month: the wizard's default", () => {
    expect(
      countInMonth(
        [
          row(1, "2026-10-05", "SETTLED"),
          row(2, "2026-11-05"),
          row(3, "2026-11-20"),
          row(4, "2026-12-05"),
        ],
        "2026-11",
      ),
    ).toBe(2);
  });

  it("does not count a paid or covered installment of the month", () => {
    expect(
      countInMonth(
        [row(1, "2026-11-05", "SETTLED"), row(2, "2026-11-06", "COVERED")],
        "2026-11",
      ),
    ).toBe(0);
  });

  it("is zero when none falls in the month", () => {
    expect(countInMonth([row(2, "2026-12-05")], "2026-11")).toBe(0);
  });
});

describe("planCounts", () => {
  const plan = (id: string, installments: InstallmentRow[]): PlanForReflow => ({
    id,
    description: id,
    dayOfMonth: 5,
    installments,
  });

  it("collects the moves of every plan asked for", () => {
    const moves = planCounts({
      plans: [plan("a", twelve()), plan("b", [row(7, "2026-11-05")])],
      requested: [
        { planId: "a", count: 2 },
        { planId: "b", count: 0 },
      ],
      month: "2026-11",
    });

    expect(moves).toContainEqual({ id: "exp_3", date: "2026-11-05" });
    expect(moves).toContainEqual({ id: "exp_7", date: "2026-12-05" });
  });

  it("ignores a plan that is not among the user's", () => {
    expect(
      planCounts({
        plans: [plan("a", twelve())],
        requested: [{ planId: "someone_elses", count: 3 }],
        month: "2026-11",
      }),
    ).toEqual([]);
  });

  it("ignores a plan asked for twice after the first request", () => {
    const moves = planCounts({
      plans: [plan("a", twelve())],
      requested: [
        { planId: "a", count: 0 },
        { planId: "a", count: 5 },
      ],
      month: "2026-11",
    });

    expect(moves).toContainEqual({ id: "exp_2", date: "2026-12-05" });
  });

  it("throws, naming the plan, for a count above what is pending", () => {
    expect(() =>
      planCounts({
        plans: [plan("a", [row(1, "2026-11-05")])],
        requested: [{ planId: "a", count: 2 }],
        month: "2026-11",
      }),
    ).toThrow(expect.objectContaining({ description: "a" }));
  });
});
