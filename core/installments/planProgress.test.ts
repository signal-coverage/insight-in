import { describe, expect, it } from "vitest";

import { distinctPlanIds, toPlanProgress } from "./planProgress";

const group = (
  installmentPlanId: string | null,
  status: "PLANNED" | "SETTLED" | "COVERED",
  count: number,
) => ({ installmentPlanId, status, _count: { _all: count } });

describe("distinctPlanIds", () => {
  it("lists each plan of the rows once and skips the entries without a plan", () => {
    expect(
      distinctPlanIds([
        { installmentPlanId: "plan_1" },
        { installmentPlanId: null },
        { installmentPlanId: "plan_2" },
        { installmentPlanId: "plan_1" },
      ]),
    ).toEqual(["plan_1", "plan_2"]);
  });

  it("is empty when no row belongs to a plan", () => {
    expect(distinctPlanIds([{ installmentPlanId: null }])).toEqual([]);
  });
});

describe("toPlanProgress", () => {
  it("adds up the entries of each plan, counting everything but planned as settled", () => {
    expect(
      toPlanProgress([
        group("plan_1", "PLANNED", 9),
        group("plan_1", "SETTLED", 2),
        group("plan_1", "COVERED", 1),
        group("plan_2", "PLANNED", 3),
      ]),
    ).toEqual({
      plan_1: { total: 12, settled: 3 },
      plan_2: { total: 3, settled: 0 },
    });
  });

  it("ignores entries that belong to no plan", () => {
    expect(toPlanProgress([group(null, "SETTLED", 4)])).toEqual({});
  });
});
