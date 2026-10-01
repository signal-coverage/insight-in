import { describe, expect, it } from "vitest";

import { isActivePath } from "./utils";

describe("isActivePath", () => {
  it("is active on its own address", () => {
    expect(isActivePath("/dashboard/overview", "/dashboard/overview")).toBe(
      true,
    );
  });

  it("is active on the addresses under it", () => {
    expect(
      isActivePath("/dashboard/overview/project", "/dashboard/overview"),
    ).toBe(true);
  });

  it("is not active on a sibling that merely starts with the same letters", () => {
    expect(isActivePath("/dashboard/overviews", "/dashboard/overview")).toBe(
      false,
    );
  });

  it("is not active elsewhere", () => {
    expect(isActivePath("/dashboard/incomes", "/dashboard/overview")).toBe(
      false,
    );
  });

  describe("when it must match exactly", () => {
    it("is active on its own address", () => {
      expect(
        isActivePath("/dashboard/overview", "/dashboard/overview", true),
      ).toBe(true);
    });

    it("is not active on the addresses under it, which have an item of their own", () => {
      expect(
        isActivePath(
          "/dashboard/overview/project",
          "/dashboard/overview",
          true,
        ),
      ).toBe(false);
    });
  });
});
