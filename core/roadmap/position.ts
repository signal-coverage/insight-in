import { MIN_POSITION_GAP, POSITION_STEP } from "./consts";

// The position of a card that goes between two neighbours (`null` for the end of the column it is
// next to): the midpoint of the two, or one step past the single neighbour there is. Moving a card
// therefore writes only that card, never its neighbours.
export const positionBetween = (
  before: number | null,
  after: number | null,
): number => {
  if (before === null && after === null) {
    return POSITION_STEP;
  }

  if (before === null) {
    return (after as number) - POSITION_STEP;
  }

  if (after === null) {
    return before + POSITION_STEP;
  }

  return (before + after) / 2;
};

// Whether two neighbours are too close for their midpoint to tell them apart (a float halves only so
// many times). An end of the column always has room, so only a pair can collapse.
export const needsRenumber = (
  before: number | null,
  after: number | null,
): boolean =>
  before !== null && after !== null && after - before < MIN_POSITION_GAP;

// The positions of a column of `count` cards numbered from scratch, in order.
export const renumbered = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => (index + 1) * POSITION_STEP);
