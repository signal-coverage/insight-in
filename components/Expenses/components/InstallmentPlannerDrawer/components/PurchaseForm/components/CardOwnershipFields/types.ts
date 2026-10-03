import type { CardOwnership } from "@/core/installments/types";

import type { CardOption } from "../../../../../../types";
import type { CardRecommendationItem, PurchaseValues } from "../../../../types";

export interface CardOwnershipFieldsProps {
  values: PurchaseValues;
  // The user's cards: an own card is chosen among them.
  cards: readonly CardOption[];
  // How each card suits the purchase, or null while the data is not enough to tell.
  recommendations: readonly CardRecommendationItem[] | null;
  onChange: (patch: Partial<PurchaseValues>) => void;
}

export interface OwnershipOption {
  value: CardOwnership;
  label: string;
  // A hint under the option.
  description?: string;
}
