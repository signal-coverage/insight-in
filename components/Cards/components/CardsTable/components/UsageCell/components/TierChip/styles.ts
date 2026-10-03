import type { CardTier } from "@/core/cards/types";

export const ICON_CLASS_NAME = "size-3.5 shrink-0";

// The tooltip's trigger wraps the chip tightly, and rounds like it so the focus ring does too.
export const TRIGGER_CLASS_NAME = "shrink-0 rounded-full";

// Green for a card with room, from the `positive` tokens every theme defines. The other two tiers
// take their colour from the chip itself.
export const TIER_CLASS_NAMES: Readonly<Record<CardTier, string>> = {
  available: "bg-positive-soft text-positive-soft-foreground",
  near: "",
  exceeded: "",
};
