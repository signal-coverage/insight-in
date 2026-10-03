import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

import { NEAR_LIMIT_PERCENT } from "@/core/cards/consts";
import type { CardTier } from "@/core/cards/types";

import type { TierChipColor } from "./types";

// Said in words and shown with an icon of its own, so the tier never rests on a colour alone.
export const TIER_LABELS: Readonly<Record<CardTier, string>> = {
  available: "Disponible",
  near: "Cerca del tope",
  exceeded: "Excedida",
};

// What each tier means in numbers, as the chip's tooltip. The 80% is the one the tiers are computed with.
export const TIER_MEANINGS: Readonly<Record<CardTier, string>> = {
  available: `${TIER_LABELS.available}: usás hasta el ${NEAR_LIMIT_PERCENT}% del tope`,
  near: `${TIER_LABELS.near}: usás entre el ${NEAR_LIMIT_PERCENT}% y el 100%`,
  exceeded: `${TIER_LABELS.exceeded}: pasaste el tope`,
};

export const TIER_ICONS: Readonly<
  Record<CardTier, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  available: CheckCircleIcon,
  near: ExclamationTriangleIcon,
  exceeded: XCircleIcon,
};

// Near the cap is warm (HeroUI's warning) and exceeded is red (danger). Available is green, which
// is the app's own `positive` token (see TIER_CLASS_NAMES), so it keeps HeroUI's neutral colour.
export const TIER_COLORS: Readonly<Record<CardTier, TierChipColor>> = {
  available: "default",
  near: "warning",
  exceeded: "danger",
};
