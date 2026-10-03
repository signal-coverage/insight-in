import type { EntryCategory } from "@/components/Entries/types";

import type { CardOption } from "../../../../types";
import type { CardRecommendationItem, PurchaseValues } from "../../types";

export interface PurchaseFormProps {
  values: PurchaseValues;
  categories: readonly EntryCategory[];
  // The user's cards: an own card is chosen among them.
  cards: readonly CardOption[];
  // The live line under the inputs ("12 cuotas de ... · total ..."), or null while the data is not
  // enough to work it out.
  preview: string | null;
  // How each card suits the purchase, or null while the data is not enough to tell.
  recommendations: readonly CardRecommendationItem[] | null;
  // "Primera cuota: 5 nov 2026", shown under the purchase date once an own card is chosen.
  firstInstallment: string | null;
  onChange: (patch: Partial<PurchaseValues>) => void;
}
