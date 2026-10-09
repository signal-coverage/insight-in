import { describe, expect, it } from "vitest";

import {
  barLength,
  clampIndex,
  extentOf,
  hoverRects,
  linePath,
  scale,
  tooltipSide,
} from "./utils";

describe("scale", () => {
  it("maps a value of the domain onto the range, in either direction", () => {
    expect(scale(5, 0, 10, 0, 100)).toBe(50);
    expect(scale(0, 0, 10, 200, 0)).toBe(200);
    expect(scale(10, 0, 10, 200, 0)).toBe(0);
  });

  it("puts every value of a flat domain in the middle", () => {
    expect(scale(7, 7, 7, 0, 100)).toBe(50);
  });

  it("keeps a negative domain finite and in order", () => {
    // -50 of [-100, -10] onto [188, 12]: 188 + (50 / 90) * -176 = 90.2222...
    expect(scale(-50, -100, -10, 188, 12)).toBeCloseTo(90.2222, 3);
    expect(scale(-100, -100, -10, 188, 12)).toBe(188);
    expect(scale(-10, -100, -10, 188, 12)).toBe(12);
  });
});

describe("barLength", () => {
  it("is proportional to the largest value", () => {
    expect(barLength(50, 200, 100)).toBe(25);
    expect(barLength(200, 200, 100)).toBe(100);
  });

  it("is 0 for nothing, a negative value or an empty chart", () => {
    expect(barLength(0, 200, 100)).toBe(0);
    expect(barLength(-5, 200, 100)).toBe(0);
    expect(barLength(5, 0, 100)).toBe(0);
    expect(Number.isFinite(barLength(5, 0, 100))).toBe(true);
  });

  it("never goes past the full length", () => {
    expect(barLength(300, 200, 100)).toBe(100);
  });
});

describe("linePath", () => {
  it("moves to the first point and draws a line through the others, rounded to a tenth", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5.04, y: 2.06 },
        { x: 10, y: 0 },
      ]),
    ).toBe("M0 10 L5 2.1 L10 0");
  });

  it("is only a move for a single point", () => {
    expect(linePath([{ x: 8, y: 100 }])).toBe("M8 100");
  });

  it("is empty without points", () => {
    expect(linePath([])).toBe("");
  });
});

describe("extentOf", () => {
  it("gives the lowest and the highest value", () => {
    expect(extentOf([3, -2, 9])).toEqual({ min: -2, max: 9 });
  });

  it("is the value itself for a single one, and for all-negative values", () => {
    expect(extentOf([4])).toEqual({ min: 4, max: 4 });
    expect(extentOf([-9, -3])).toEqual({ min: -9, max: -3 });
  });

  it("is zero to zero without values", () => {
    expect(extentOf([])).toEqual({ min: 0, max: 0 });
  });
});

describe("hoverRects", () => {
  it("gives a single day the whole plot", () => {
    expect(hoverRects(1, 8, 592)).toEqual([{ x: 8, width: 584 }]);
  });

  it("splits at the midpoints between days and never leaves the plot (3 days)", () => {
    // Days at 8, 300, 592: the borders are 154 and 446.
    expect(hoverRects(3, 8, 592)).toEqual([
      { x: 8, width: 146 },
      { x: 154, width: 292 },
      { x: 446, width: 146 },
    ]);
  });

  it("keeps every rect inside the plot, apart and covering it, for any number of days", () => {
    for (const count of [1, 2, 3, 7, 30, 31]) {
      const rects = hoverRects(count, 8, 592);

      expect(rects).toHaveLength(count);
      expect(rects[0].x).toBe(8);

      rects.forEach((rect, index) => {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(600);

        if (index > 0) {
          const before = rects[index - 1];

          expect(rect.x).toBeCloseTo(before.x + before.width, 9);
        }
      });

      const lastRect = rects[count - 1];

      expect(lastRect.x + lastRect.width).toBeCloseTo(592, 9);
    }
  });

  it("keeps the interior rects at their natural width: the distance between days", () => {
    // 31 days over 584: a step of 584 / 30.
    const rects = hoverRects(31, 8, 592);

    expect(rects[1].width).toBeCloseTo(584 / 30, 9);
    expect(rects[15].width).toBeCloseTo(584 / 30, 9);
    expect(rects[0].width).toBeCloseTo(584 / 60, 9);
  });

  it("is empty without days", () => {
    expect(hoverRects(0, 8, 592)).toEqual([]);
  });
});

describe("tooltipSide", () => {
  it("anchors to the right for the left half and to the left for the right half", () => {
    expect(tooltipSide(0, 6)).toBe("right");
    expect(tooltipSide(2, 6)).toBe("right");
    expect(tooltipSide(3, 6)).toBe("left");
    expect(tooltipSide(5, 6)).toBe("left");
  });

  it("treats the middle of an odd count as the right half", () => {
    expect(tooltipSide(1, 3)).toBe("left");
    expect(tooltipSide(0, 3)).toBe("right");
  });
});

describe("clampIndex", () => {
  it("keeps an index inside the list", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(5, 3)).toBe(2);
  });
});
