import { BRAND_NAMES } from "@/core/cards/consts";

import { BrandLogo } from "../../../BrandLogo";
import { GENERIC_BRAND_WORD, PREVIEW_LABEL } from "./consts";
import {
  CYCLE_CLASS_NAME,
  NUMBER_CLASS_NAME,
  ROOT_CLASS_NAME,
  TOP_CLASS_NAME,
  WORD_CLASS_NAME,
} from "./styles";
import type { CardPreviewProps } from "./types";
import { cycleText, maskedNumber } from "./utils";

// A card-shaped preview of what the form describes, drawn with CSS only. It follows the form as the
// user types; the brand name is written for screen readers, since the logo is decoration.
export function CardPreview({
  brand,
  last4,
  closingDay,
  dueDay,
}: CardPreviewProps) {
  return (
    <div
      role="group"
      aria-label={PREVIEW_LABEL}
      data-brand={brand}
      className={ROOT_CLASS_NAME}
    >
      <div className={TOP_CLASS_NAME}>
        <BrandLogo brand={brand} size="lg" />
        {brand === "OTHER" ? (
          <span className={WORD_CLASS_NAME}>{GENERIC_BRAND_WORD}</span>
        ) : null}
        <span className="sr-only">{BRAND_NAMES[brand]}</span>
      </div>
      <p className={NUMBER_CLASS_NAME}>{maskedNumber(last4)}</p>
      <p className={CYCLE_CLASS_NAME}>{cycleText(closingDay, dueDay)}</p>
    </div>
  );
}
