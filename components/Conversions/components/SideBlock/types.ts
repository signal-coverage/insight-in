import type { PairView } from "../../types";
import type { ConversionSide } from "@/core/conversions/types";

export interface SideBlockProps {
  side: ConversionSide;
  // One per (origin, net) pair, each with its own figures.
  pairs: PairView[];
}
