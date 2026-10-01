import { describe, expect, it } from "vitest";

import { DEFAULT_ENTRIES_QUERY } from "./query";
import type { EntriesQuery } from "./query";
import {
  buildEntriesOrderBy,
  buildEntriesWhere,
  foldCurrencyTotals,
} from "./listing";

const query = (patch: Partial<EntriesQuery> = {}): EntriesQuery => ({
  ...DEFAULT_ENTRIES_QUERY,
  ...patch,
});

describe("buildEntriesWhere", () => {
  it("always leads with the owner and adds nothing for the default query", () => {
    expect(buildEntriesWhere("user_1", query())).toEqual({ userId: "user_1" });
  });

  it("adds each filter that is set", () => {
    expect(
      buildEntriesWhere(
        "user_1",
        query({
          categoryId: "cat_1",
          currency: "USD",
          status: "PLANNED",
          from: "2026-01-01",
          to: "2026-01-31",
        }),
      ),
    ).toEqual({
      userId: "user_1",
      categoryId: "cat_1",
      currency: "USD",
      status: "PLANNED",
      date: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-01-31T00:00:00.000Z"),
      },
    });
  });

  it("supports an open-ended date range", () => {
    expect(buildEntriesWhere("u", query({ to: "2026-01-31" })).date).toEqual({
      lte: new Date("2026-01-31T00:00:00.000Z"),
    });
  });
});

describe("buildEntriesOrderBy", () => {
  it("sorts by date with stable tie-breakers", () => {
    expect(
      buildEntriesOrderBy(query({ sort: "date", direction: "asc" })),
    ).toEqual([{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
  });

  it("sorts text columns and breaks ties by newest first", () => {
    expect(
      buildEntriesOrderBy(query({ sort: "description", direction: "asc" })),
    ).toEqual([
      { description: "asc" },
      { date: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(
      buildEntriesOrderBy(query({ sort: "category", direction: "desc" }))[0],
    ).toEqual({
      category: { name: "desc" },
    });
  });
});

describe("foldCurrencyTotals", () => {
  it("folds the per-status groups into one row per currency, sorted by currency", () => {
    expect(
      foldCurrencyTotals([
        { currency: "USD", status: "SETTLED", _sum: { amount: BigInt(1000) } },
        { currency: "USD", status: "PLANNED", _sum: { amount: BigInt(500) } },
        { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(70000) } },
      ]),
    ).toEqual([
      { currency: "ARS", total: 70000, settled: 0 },
      { currency: "USD", total: 1500, settled: 1000 },
    ]);
  });

  it("skips groups without a sum", () => {
    expect(
      foldCurrencyTotals([
        { currency: "USD", status: "SETTLED", _sum: { amount: null } },
      ]),
    ).toEqual([]);
  });

  it("returns an empty list for no groups", () => {
    expect(foldCurrencyTotals([])).toEqual([]);
  });
});
