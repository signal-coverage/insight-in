import { describe, expect, it } from "vitest";

import { sectionAddress, sectionParams } from "./utils";

describe("sectionParams", () => {
  it("writes the sections other than the default one", () => {
    expect(sectionParams("month")).toEqual({ section: "month" });
    expect(sectionParams("history")).toEqual({ section: "history" });
  });

  it("writes nothing for the default section", () => {
    expect(sectionParams("accounts")).toEqual({});
  });
});

describe("sectionAddress", () => {
  const at = (search: string, hash = "") => ({
    pathname: "/dashboard/overview",
    search,
    hash,
  });

  it("writes the section and keeps the month, the currency, every other parameter and the hash", () => {
    expect(
      sectionAddress(
        at("?month=2026-08&currency=USD&status=PLANNED", "#a"),
        "history",
      ),
    ).toBe(
      "/dashboard/overview?month=2026-08&currency=USD&status=PLANNED&section=history#a",
    );
  });

  it("replaces the section the address already has", () => {
    expect(sectionAddress(at("?section=month&currency=USD"), "history")).toBe(
      "/dashboard/overview?section=history&currency=USD",
    );
  });

  it("drops the section for the default one but keeps the rest", () => {
    expect(
      sectionAddress(at("?section=month&currency=USD", "#a"), "accounts"),
    ).toBe("/dashboard/overview?currency=USD#a");
    expect(sectionAddress(at("?section=month"), "accounts")).toBe(
      "/dashboard/overview",
    );
  });
});
