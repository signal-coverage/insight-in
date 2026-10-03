import type { CardRecommendationItem } from "../../../../types";

export interface CardRecommendationsProps {
  // How each card of the purchase's currency suits it, the best first. Empty when there is none.
  items: readonly CardRecommendationItem[];
}
