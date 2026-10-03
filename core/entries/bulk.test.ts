import { describe, expect, it } from "vitest";

import { MAX_BULK_DELETE, bulkIdsSchema } from "./bulk";

describe("bulkIdsSchema", () => {
  it("accepts a list of ids", () => {
    expect(bulkIdsSchema.parse(["a", "b"])).toEqual(["a", "b"]);
  });

  it("drops repeated ids, keeping the first of each", () => {
    expect(bulkIdsSchema.parse(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("refuses an empty list", () => {
    expect(bulkIdsSchema.safeParse([]).success).toBe(false);
  });

  it("refuses anything that is not a list of non-empty text", () => {
    expect(bulkIdsSchema.safeParse(undefined).success).toBe(false);
    expect(bulkIdsSchema.safeParse("a").success).toBe(false);
    expect(bulkIdsSchema.safeParse([1, 2]).success).toBe(false);
    expect(bulkIdsSchema.safeParse(["a", ""]).success).toBe(false);
    expect(bulkIdsSchema.safeParse(["a", "   "]).success).toBe(false);
  });

  it("accepts the largest list and refuses one more", () => {
    const ids = (count: number) =>
      Array.from({ length: count }, (_, index) => `id_${index}`);

    expect(bulkIdsSchema.safeParse(ids(MAX_BULK_DELETE)).success).toBe(true);
    expect(bulkIdsSchema.safeParse(ids(MAX_BULK_DELETE + 1)).success).toBe(
      false,
    );
  });

  it("allows 200 ids at most", () => {
    expect(MAX_BULK_DELETE).toBe(200);
  });
});
