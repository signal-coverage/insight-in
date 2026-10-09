// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ current: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

import { useSelectedCurrency } from "./useSelectedCurrency";

const read = (query: string, month = "2026-09", currentMonth = "2026-09") => {
  search.current = query;

  return renderHook(() => useSelectedCurrency(month, currentMonth)).result
    .current;
};

describe("useSelectedCurrency", () => {
  it("reads the currency the address asks for, in capitals", () => {
    expect(read("currency=usd").selected).toBe("USD");
  });

  it("is null when the address asks for none", () => {
    expect(read("").selected).toBeNull();
  });

  it("carries a currency other than ARS into the addresses it builds, and the month when it is not the current one", () => {
    const { params, retryHref } = read("currency=USD", "2026-08");

    expect(params).toEqual({ currency: "USD" });
    expect(retryHref).toBe("/dashboard/overview?month=2026-08&currency=USD");
  });

  it("writes no currency for ARS, the default, nor for none (twin of the case above)", () => {
    expect(read("currency=ARS").retryHref).toBe("/dashboard/overview");
    expect(read("").retryHref).toBe("/dashboard/overview");
  });

  it("reads the section the address asks for, accounts when it asks for none or an unknown one", () => {
    expect(read("section=history").section).toBe("history");
    expect(read("section=month").section).toBe("month");
    expect(read("").section).toBe("accounts");
    expect(read("section=nope").section).toBe("accounts");
  });

  it("carries the section along with the currency into the addresses it builds", () => {
    const { params, retryHref } = read("currency=USD&section=month", "2026-08");

    expect(params).toEqual({ currency: "USD", section: "month" });
    expect(retryHref).toBe(
      "/dashboard/overview?month=2026-08&currency=USD&section=month",
    );
    expect(read("section=history").retryHref).toBe(
      "/dashboard/overview?section=history",
    );
  });

  it("writes no section for the default one (twin of the case above)", () => {
    expect(read("currency=USD&section=accounts").retryHref).toBe(
      "/dashboard/overview?currency=USD",
    );
  });
});
