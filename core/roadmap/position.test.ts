import { describe, expect, it } from "vitest";

import { MIN_POSITION_GAP, POSITION_STEP } from "./consts";
import { needsRenumber, positionBetween, renumbered } from "./position";

describe("positionBetween", () => {
  it("starts an empty column at the step", () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
  });

  it("goes one step past the last card when there is nothing after", () => {
    expect(positionBetween(3000, null)).toBe(3000 + POSITION_STEP);
  });

  it("goes one step before the first card when there is nothing before", () => {
    expect(positionBetween(null, 1024)).toBe(1024 - POSITION_STEP);
  });

  it("takes the midpoint between two neighbours", () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it("stays strictly between the neighbours however small the gap", () => {
    const before = 1;
    const after = 1 + 2 ** -10;
    const position = positionBetween(before, after);

    expect(position).toBeGreaterThan(before);
    expect(position).toBeLessThan(after);
  });
});

describe("needsRenumber", () => {
  it("is not needed at an end of the column, where there is always room", () => {
    expect(needsRenumber(null, 5)).toBe(false);
    expect(needsRenumber(5, null)).toBe(false);
    expect(needsRenumber(null, null)).toBe(false);
  });

  it("is not needed while the gap is wide enough", () => {
    expect(needsRenumber(1024, 2048)).toBe(false);
    expect(needsRenumber(1, 1 + MIN_POSITION_GAP * 2)).toBe(false);
  });

  it("is needed once the gap has collapsed", () => {
    expect(needsRenumber(1, 1 + MIN_POSITION_GAP / 2)).toBe(true);
  });

  it("is needed for two neighbours that share a position", () => {
    expect(needsRenumber(7, 7)).toBe(true);
  });
});

describe("renumbered", () => {
  it("spaces the positions by the step, from the first step", () => {
    expect(renumbered(3)).toEqual([
      POSITION_STEP,
      POSITION_STEP * 2,
      POSITION_STEP * 3,
    ]);
  });

  it("is empty for an empty column", () => {
    expect(renumbered(0)).toEqual([]);
  });
});
