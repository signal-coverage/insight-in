import { describe, expect, it } from "vitest";

import { mergeCategories } from "./utils";

describe("mergeCategories", () => {
  it("appends added categories and sorts everything by name", () => {
    expect(
      mergeCategories(
        [
          { id: "b", name: "Salary" },
          { id: "a", name: "Gifts" },
        ],
        [{ id: "c", name: "Freelance" }],
      ),
    ).toEqual([
      { id: "c", name: "Freelance" },
      { id: "a", name: "Gifts" },
      { id: "b", name: "Salary" },
    ]);
  });

  it("does not duplicate a category already present in the base list", () => {
    expect(
      mergeCategories(
        [{ id: "a", name: "Gifts" }],
        [{ id: "a", name: "Gifts" }],
      ),
    ).toEqual([{ id: "a", name: "Gifts" }]);
  });

  it("does not mutate its inputs", () => {
    const base = [
      { id: "b", name: "Salary" },
      { id: "a", name: "Gifts" },
    ];

    mergeCategories(base, []);

    expect(base.map((category) => category.id)).toEqual(["b", "a"]);
  });
});
