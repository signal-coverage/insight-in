import { describe, expect, it } from "vitest";

import {
  clearFilters,
  DEFAULT_ENTRIES_QUERY,
  defaultDateRange,
  hasActiveFilters,
  parseEntriesQuery,
  serializeEntriesQuery,
  withQueryChange,
} from "./query";

// Mid-month on purpose: the default range must reach the end of the month, not stop at today.
const TODAY = "2026-09-15";
const IN_DEFAULT_RANGE = {
  ...DEFAULT_ENTRIES_QUERY,
  from: "2026-09-01",
  to: "2026-09-30",
};

describe("defaultDateRange", () => {
  it.each([
    {
      label: "a 30-day month",
      today: "2026-09-15",
      from: "2026-09-01",
      to: "2026-09-30",
    },
    {
      label: "a 31-day month",
      today: "2026-10-02",
      from: "2026-10-01",
      to: "2026-10-31",
    },
    {
      label: "February in a leap year",
      today: "2028-02-10",
      from: "2028-02-01",
      to: "2028-02-29",
    },
    {
      label: "February in a non-leap year",
      today: "2026-02-10",
      from: "2026-02-01",
      to: "2026-02-28",
    },
    {
      label: "the last day of the month",
      today: "2026-09-30",
      from: "2026-09-01",
      to: "2026-09-30",
    },
    {
      label: "the first day of the month",
      today: "2026-12-01",
      from: "2026-12-01",
      to: "2026-12-31",
    },
  ])("is the whole month of today for $label", ({ today, from, to }) => {
    expect(defaultDateRange(today)).toEqual({ from, to });
  });
});

describe("hasActiveFilters relative to the default state", () => {
  it("is false in the default state: the current month and nothing else", () => {
    expect(hasActiveFilters(IN_DEFAULT_RANGE, TODAY)).toBe(false);
  });

  it("stays false when only sorting or paging differs", () => {
    expect(
      hasActiveFilters(
        { ...IN_DEFAULT_RANGE, page: 3, sort: "category", direction: "asc" },
        TODAY,
      ),
    ).toBe(false);
  });

  it.each([{ categoryId: "c" }, { currency: "USD" }])(
    "is true when %j is set",
    (patch) => {
      expect(hasActiveFilters({ ...IN_DEFAULT_RANGE, ...patch }, TODAY)).toBe(
        true,
      );
    },
  );

  it.each([
    { label: "a different start", patch: { from: "2026-01-01" } },
    { label: "a different end", patch: { to: "2026-09-15" } },
    { label: "no start", patch: { from: null } },
    { label: "no end", patch: { to: null } },
    {
      label: "no dates at all (the whole history)",
      patch: { from: null, to: null },
    },
  ])("is true with $label", ({ patch }) => {
    expect(hasActiveFilters({ ...IN_DEFAULT_RANGE, ...patch }, TODAY)).toBe(
      true,
    );
  });

  it("treats last month's default range as active once the month rolls over", () => {
    expect(hasActiveFilters(IN_DEFAULT_RANGE, "2026-10-01")).toBe(true);
  });

  it("counts an end date of today as active, since the default now reaches the end of the month", () => {
    expect(hasActiveFilters({ ...IN_DEFAULT_RANGE, to: TODAY }, TODAY)).toBe(
      true,
    );
  });

  it("stays false on the last day of the month with the whole-month range", () => {
    expect(hasActiveFilters(IN_DEFAULT_RANGE, "2026-09-30")).toBe(false);
  });
});

describe("clearFilters back to the default state", () => {
  const messy = {
    page: 4,
    from: "2026-01-01",
    to: "2026-02-01",
    categoryId: "c",
    currency: "USD",
    status: "PLANNED" as const,
    sort: "category" as const,
    direction: "desc" as const,
  };

  it("restores the whole current month and drops category and currency", () => {
    expect(clearFilters(messy, TODAY)).toEqual({
      page: 1,
      from: "2026-09-01",
      to: "2026-09-30",
      categoryId: null,
      currency: null,
      status: null,
      sort: "category",
      direction: "desc",
    });
  });

  it("brings back the range even when the user had removed the dates", () => {
    expect(
      clearFilters({ ...messy, from: null, to: null }, TODAY),
    ).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("leaves the result with no active filters", () => {
    expect(hasActiveFilters(clearFilters(messy, TODAY), TODAY)).toBe(false);
  });

  it("returns to the whole month, not to today, from a range that ends today", () => {
    expect(
      clearFilters({ ...messy, from: "2026-09-01", to: TODAY }, TODAY),
    ).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("follows the length of the month", () => {
    expect(clearFilters(messy, "2028-02-10")).toMatchObject({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
});

describe("serializeEntriesQuery for the default state", () => {
  it("writes a clean URL when the dates are the default range", () => {
    expect(serializeEntriesQuery(IN_DEFAULT_RANGE, TODAY)).toBe("");
  });

  it("omits the whole-month range but writes a range that ends today", () => {
    expect(
      serializeEntriesQuery({ ...IN_DEFAULT_RANGE, to: TODAY }, TODAY),
    ).toBe("?from=2026-09-01&to=2026-09-15");
  });

  it("omits the whole-month range in months of other lengths", () => {
    const february = {
      ...DEFAULT_ENTRIES_QUERY,
      from: "2028-02-01",
      to: "2028-02-29",
    };

    expect(serializeEntriesQuery(february, "2028-02-10")).toBe("");
    expect(serializeEntriesQuery(february, "2026-02-10")).toBe(
      "?from=2028-02-01&to=2028-02-29",
    );
  });

  it("keeps other params without adding dates while the range is the default", () => {
    expect(
      serializeEntriesQuery(
        { ...IN_DEFAULT_RANGE, currency: "USD", page: 2 },
        TODAY,
      ),
    ).toBe("?page=2&currency=USD");
  });

  it("still writes real dates when they are not the default range", () => {
    expect(
      serializeEntriesQuery(
        { ...IN_DEFAULT_RANGE, from: "2026-08-01", to: "2026-08-31" },
        TODAY,
      ),
    ).toBe("?from=2026-08-01&to=2026-08-31");
  });

  it("still writes the explicit no-dates marker for the whole history", () => {
    expect(serializeEntriesQuery({ ...DEFAULT_ENTRIES_QUERY }, TODAY)).toBe(
      "?from=&to=",
    );
  });

  it("round-trips the default range through a clean URL", () => {
    const params = Object.fromEntries(
      new URLSearchParams(serializeEntriesQuery(IN_DEFAULT_RANGE, TODAY)),
    );

    expect(parseEntriesQuery(params, { today: TODAY })).toEqual(
      IN_DEFAULT_RANGE,
    );
  });
});

describe("parseEntriesQuery", () => {
  it("returns the defaults for empty params", () => {
    expect(parseEntriesQuery({})).toEqual(DEFAULT_ENTRIES_QUERY);
  });

  it("defaults to date descending, page 1 and no filters", () => {
    expect(DEFAULT_ENTRIES_QUERY).toEqual({
      page: 1,
      from: null,
      to: null,
      categoryId: null,
      currency: null,
      status: null,
      sort: "date",
      direction: "desc",
    });
  });

  it("reads a valid page", () => {
    expect(parseEntriesQuery({ page: "3" }).page).toBe(3);
  });

  it.each(["0", "-2", "abc", "2.5", "", "1e3"])(
    "falls back to page 1 for %j",
    (page) => {
      expect(parseEntriesQuery({ page }).page).toBe(1);
    },
  );

  it("uses the first value when a param is repeated", () => {
    expect(parseEntriesQuery({ page: ["4", "5"] }).page).toBe(4);
  });

  it("reads a valid date range", () => {
    const query = parseEntriesQuery({ from: "2026-01-01", to: "2026-03-31" });

    expect(query.from).toBe("2026-01-01");
    expect(query.to).toBe("2026-03-31");
  });

  it.each(["2026-13-01", "01/02/2026", "2026-02-30", "", "soon"])(
    "ignores the invalid date %j",
    (value) => {
      const query = parseEntriesQuery({ from: value, to: value });

      expect(query.from).toBeNull();
      expect(query.to).toBeNull();
    },
  );

  it("swaps an inverted range instead of returning nothing", () => {
    const query = parseEntriesQuery({ from: "2026-06-01", to: "2026-01-01" });

    expect(query.from).toBe("2026-01-01");
    expect(query.to).toBe("2026-06-01");
  });

  it("trims the category id and ignores a blank one", () => {
    expect(parseEntriesQuery({ categoryId: "  cat_1 " }).categoryId).toBe(
      "cat_1",
    );
    expect(parseEntriesQuery({ categoryId: "   " }).categoryId).toBeNull();
  });

  it("normalizes the currency and ignores unsupported codes", () => {
    expect(parseEntriesQuery({ currency: "usd" }).currency).toBe("USD");
    expect(parseEntriesQuery({ currency: "ZZZ" }).currency).toBeNull();
  });

  it("keeps a crypto currency filter, upper-cased like any other", () => {
    expect(parseEntriesQuery({ currency: "usdc" }).currency).toBe("USDC");
    expect(parseEntriesQuery({ currency: "BTC" }).currency).toBe("BTC");
  });

  it("reads a valid sort and direction", () => {
    const query = parseEntriesQuery({ sort: "description", direction: "desc" });

    expect(query.sort).toBe("description");
    expect(query.direction).toBe("desc");
  });

  it("falls back to date for an unknown sort, including the unsortable amount", () => {
    expect(parseEntriesQuery({ sort: "amount" }).sort).toBe("date");
    expect(parseEntriesQuery({ sort: "nonsense" }).sort).toBe("date");
  });

  it("uses the natural direction for the sort when none is given", () => {
    expect(parseEntriesQuery({ sort: "date" }).direction).toBe("desc");
    expect(parseEntriesQuery({ sort: "description" }).direction).toBe("asc");
    expect(parseEntriesQuery({ sort: "category" }).direction).toBe("asc");
  });

  it("uses the natural direction when the given one is invalid", () => {
    expect(
      parseEntriesQuery({ sort: "category", direction: "sideways" }).direction,
    ).toBe("asc");
  });

  it("never throws on odd input", () => {
    expect(() =>
      parseEntriesQuery({
        page: [],
        from: undefined,
        sort: [] as unknown as string,
      }),
    ).not.toThrow();
  });
});

describe("parseEntriesQuery with a date range default", () => {
  const today = "2026-09-15";

  it("defaults to the whole current month when the URL has no date params", () => {
    expect(parseEntriesQuery({}, { today })).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("keeps the other params when it applies the default range", () => {
    expect(
      parseEntriesQuery({ page: "2", currency: "usd" }, { today }),
    ).toMatchObject({
      page: 2,
      currency: "USD",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("uses the explicit range when the URL carries one", () => {
    expect(
      parseEntriesQuery({ from: "2026-01-01", to: "2026-02-01" }, { today }),
    ).toMatchObject({
      from: "2026-01-01",
      to: "2026-02-01",
    });
  });

  it("does not add a date the user removed when the other one is still there", () => {
    expect(parseEntriesQuery({ to: "2026-09-30" }, { today })).toMatchObject({
      from: null,
      to: "2026-09-30",
    });
    expect(parseEntriesQuery({ from: "2026-09-01" }, { today })).toMatchObject({
      from: "2026-09-01",
      to: null,
    });
  });

  it("treats present-but-empty date params as 'no date filter', not as 'use the default'", () => {
    expect(parseEntriesQuery({ from: "", to: "" }, { today })).toMatchObject({
      from: null,
      to: null,
    });
  });

  it("treats invalid date params as removed too, never as the default", () => {
    expect(
      parseEntriesQuery({ from: "garbage", to: "2026-13-40" }, { today }),
    ).toMatchObject({
      from: null,
      to: null,
    });
  });

  it("changes nothing when no 'today' is given", () => {
    expect(parseEntriesQuery({})).toEqual(DEFAULT_ENTRIES_QUERY);
  });

  it.each([
    { label: "a 30-day month", today: "2026-09-15", to: "2026-09-30" },
    { label: "a 31-day month", today: "2026-10-01", to: "2026-10-31" },
    { label: "a leap February", today: "2028-02-10", to: "2028-02-29" },
    { label: "a non-leap February", today: "2026-02-10", to: "2026-02-28" },
    {
      label: "the last day of the month",
      today: "2026-10-31",
      to: "2026-10-31",
    },
  ])("covers the whole month for $label", ({ today: day, to }) => {
    expect(parseEntriesQuery({}, { today: day })).toMatchObject({
      from: `${day.slice(0, 7)}-01`,
      to,
    });
  });

  it("lets an explicit end date of today win over the default", () => {
    expect(
      parseEntriesQuery({ from: "2026-09-01", to: today }, { today }),
    ).toMatchObject({
      from: "2026-09-01",
      to: today,
    });
  });

  it("follows the given day across a month boundary", () => {
    expect(parseEntriesQuery({}, { today: "2026-10-01" })).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
});

describe("serializeEntriesQuery", () => {
  it("says explicitly that there is no date filter, so the default range does not come back", () => {
    expect(serializeEntriesQuery(DEFAULT_ENTRIES_QUERY)).toBe("?from=&to=");
  });

  it("does not add the empty markers when at least one date is set", () => {
    expect(
      serializeEntriesQuery({ ...DEFAULT_ENTRIES_QUERY, from: "2026-09-01" }),
    ).toBe("?from=2026-09-01");
    expect(
      serializeEntriesQuery({ ...DEFAULT_ENTRIES_QUERY, to: "2026-09-30" }),
    ).toBe("?to=2026-09-30");
  });

  it("keeps a cleared range cleared after a round trip with a default in play", () => {
    const cleared = {
      ...DEFAULT_ENTRIES_QUERY,
      sort: "description" as const,
      direction: "asc" as const,
    };
    const params = Object.fromEntries(
      new URLSearchParams(serializeEntriesQuery(cleared)),
    );

    expect(parseEntriesQuery(params, { today: "2026-09-30" })).toEqual(cleared);
  });

  it("includes only what differs from the defaults, plus the explicit no-dates marker", () => {
    expect(
      serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        page: 2,
        categoryId: "cat_1",
        sort: "description",
        direction: "desc",
      }),
    ).toBe(
      "?page=2&from=&to=&categoryId=cat_1&sort=description&direction=desc",
    );
  });

  it("omits the direction when it is the natural one for the sort", () => {
    expect(
      serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        sort: "category",
        direction: "asc",
      }),
    ).toBe("?from=&to=&sort=category");
  });

  it("writes only the real dates, without markers, when a range is set", () => {
    expect(
      serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        from: "2026-09-01",
        to: "2026-09-30",
        sort: "category",
        direction: "asc",
      }),
    ).toBe("?from=2026-09-01&to=2026-09-30&sort=category");
  });

  it("round-trips through the parser", () => {
    const queries = [
      {
        ...DEFAULT_ENTRIES_QUERY,
        from: "2026-01-01",
        to: "2026-02-01",
        currency: "EUR",
      },
      {
        ...DEFAULT_ENTRIES_QUERY,
        page: 4,
        sort: "category" as const,
        direction: "desc" as const,
      },
      { ...DEFAULT_ENTRIES_QUERY, direction: "asc" as const },
    ];

    queries.forEach((query) => {
      const params = Object.fromEntries(
        new URLSearchParams(serializeEntriesQuery(query)),
      );

      expect(parseEntriesQuery(params)).toEqual(query);
    });
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults and for sorting or paging alone", () => {
    expect(hasActiveFilters(DEFAULT_ENTRIES_QUERY)).toBe(false);
    expect(
      hasActiveFilters({
        ...DEFAULT_ENTRIES_QUERY,
        page: 3,
        sort: "category",
        direction: "asc",
      }),
    ).toBe(false);
  });

  it.each([
    { from: "2026-01-01" },
    { to: "2026-01-01" },
    { categoryId: "c" },
    { currency: "USD" },
  ])("is true when %j is set", (patch) => {
    expect(hasActiveFilters({ ...DEFAULT_ENTRIES_QUERY, ...patch })).toBe(true);
  });
});

describe("withQueryChange", () => {
  const onPageThree = { ...DEFAULT_ENTRIES_QUERY, page: 3 };

  it("resets to page 1 when a filter or the sort changes", () => {
    expect(withQueryChange(onPageThree, { categoryId: "c" }).page).toBe(1);
    expect(
      withQueryChange(onPageThree, { sort: "description", direction: "asc" })
        .page,
    ).toBe(1);
  });

  it("keeps an explicit page", () => {
    expect(withQueryChange(onPageThree, { page: 2 }).page).toBe(2);
  });

  it("keeps the rest of the query", () => {
    expect(
      withQueryChange({ ...onPageThree, currency: "USD" }, { categoryId: "c" }),
    ).toMatchObject({
      currency: "USD",
      categoryId: "c",
    });
  });
});

describe("clearFilters", () => {
  it("removes every filter and returns to page 1 but keeps the sort", () => {
    expect(
      clearFilters({
        page: 4,
        from: "2026-01-01",
        to: "2026-02-01",
        categoryId: "c",
        currency: "USD",
        status: "PLANNED",
        sort: "category",
        direction: "desc",
      }),
    ).toEqual({
      ...DEFAULT_ENTRIES_QUERY,
      sort: "category",
      direction: "desc",
    });
  });
});

describe("the status filter", () => {
  it("is off by default", () => {
    expect(DEFAULT_ENTRIES_QUERY.status).toBeNull();
    expect(parseEntriesQuery({}).status).toBeNull();
  });

  it.each(["PLANNED", "SETTLED", "COVERED"] as const)(
    "reads %s from the URL",
    (status) => {
      expect(parseEntriesQuery({ status }).status).toBe(status);
    },
  );

  it("writes COVERED to the URL like any other status", () => {
    expect(
      serializeEntriesQuery({ ...DEFAULT_ENTRIES_QUERY, status: "COVERED" }),
    ).toBe("?from=&to=&status=COVERED");
  });

  it.each(["settled", "DONE", "", "PLANNED,SETTLED"])(
    "ignores the invalid value %j",
    (status) => {
      expect(parseEntriesQuery({ status }).status).toBeNull();
    },
  );

  it("is written to the URL only when set", () => {
    expect(
      serializeEntriesQuery({ ...DEFAULT_ENTRIES_QUERY, status: "PLANNED" }),
    ).toBe("?from=&to=&status=PLANNED");
    expect(serializeEntriesQuery(DEFAULT_ENTRIES_QUERY)).not.toContain(
      "status",
    );
  });

  it("counts as an active filter", () => {
    expect(
      hasActiveFilters({ ...IN_DEFAULT_RANGE, status: "SETTLED" }, TODAY),
    ).toBe(true);
  });

  it("is removed by clearing the filters", () => {
    expect(
      clearFilters({ ...IN_DEFAULT_RANGE, status: "SETTLED" }, TODAY).status,
    ).toBeNull();
  });

  it("goes back to page 1 when it changes", () => {
    expect(
      withQueryChange(
        { ...DEFAULT_ENTRIES_QUERY, page: 3 },
        { status: "PLANNED" },
      ).page,
    ).toBe(1);
  });
});
