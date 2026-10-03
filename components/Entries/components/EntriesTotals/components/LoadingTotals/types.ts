import type { EntriesTotalsProps } from "../../types";

// The words the placeholder cards carry: the group's accessible name and the labels of the
// settled and pending cards (the total card is always "Total").
export type LoadingTotalsProps = Pick<
  EntriesTotalsProps,
  "ariaLabel" | "settledLabel" | "pendingLabel"
>;
