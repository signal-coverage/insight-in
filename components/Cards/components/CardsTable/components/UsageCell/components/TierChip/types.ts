import type { CardTier } from "@/core/cards/types";

export interface TierChipProps {
  tier: CardTier;
}

// The HeroUI chip colours a tier uses.
export type TierChipColor = "default" | "warning" | "danger";
