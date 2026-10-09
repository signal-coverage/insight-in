// The geometry of the charts. Pure: it only maps numbers onto the drawing.

// Maps `value` of [min, max] onto [start, end] (end may be smaller: an SVG's y grows downwards). A flat
// domain puts every value in the middle.
export const scale = (
  value: number,
  min: number,
  max: number,
  start: number,
  end: number,
): number =>
  max === min
    ? (start + end) / 2
    : start + ((value - min) / (max - min)) * (end - start);

// How long a bar is, from its baseline, when the largest value takes `length`.
export const barLength = (
  value: number,
  max: number,
  length: number,
): number =>
  max <= 0 || value <= 0 ? 0 : (Math.min(value, max) / max) * length;

const round = (value: number): number => Math.round(value * 10) / 10;

// An SVG path through the points, in order.
export const linePath = (points: readonly { x: number; y: number }[]): string =>
  points
    .map(
      ({ x, y }, index) => `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`,
    )
    .join(" ");

export const extentOf = (
  values: readonly number[],
): { min: number; max: number } =>
  values.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...values), max: Math.max(...values) };

// The pointer areas of `count` days spread from `left` to `right`: each one is split at the midpoint
// between neighbours, so they never overlap and never leave the plot (the first and the last stop at its
// edges, a single day takes all of it).
export const hoverRects = (
  count: number,
  left: number,
  right: number,
): { x: number; width: number }[] =>
  Array.from({ length: count }, (_, index) => {
    const step = count > 1 ? (right - left) / (count - 1) : 0;
    const start = index === 0 ? left : left + step * (index - 0.5);
    const end = index === count - 1 ? right : left + step * (index + 0.5);

    return { x: start, width: end - start };
  });

// Which edge of the chart a tooltip sticks to: away from the month it describes, so it never covers it.
export const tooltipSide = (index: number, count: number): "left" | "right" =>
  index >= (count - 1) / 2 ? "left" : "right";

export const clampIndex = (index: number, length: number): number =>
  Math.min(Math.max(index, 0), length - 1);
