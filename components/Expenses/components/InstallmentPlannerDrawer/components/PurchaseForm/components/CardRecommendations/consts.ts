import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

import type { CardVerdict } from "@/core/cards/types";

export const HEADING = "Tarjetas para esta compra";
export const RECOMMENDED_LABEL = "Recomendada";
export const NO_CARDS_MESSAGE = "No tenés tarjetas en esta moneda.";

// Every verdict is said in words and has an icon of its own, so it never rests on a colour alone.
export const VERDICT_ICONS: Readonly<
  Record<CardVerdict, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  fits: CheckCircleIcon,
  near: ExclamationTriangleIcon,
  exceeded: XCircleIcon,
};
