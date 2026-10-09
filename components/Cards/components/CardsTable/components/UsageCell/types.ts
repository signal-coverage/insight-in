import type { CardLimitRow } from "../../../../types";

export interface UsageCellProps {
  // The card's title, to name the bar.
  title: string;
  limit: CardLimitRow;
}
