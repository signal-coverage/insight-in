import { CreditCardIcon } from "@heroicons/react/24/outline";

import { REMIX_LOGO_BY_BRAND } from "./consts";
import {
  BADGE_CLASS_NAMES,
  FALLBACK_ICON_CLASS_NAMES,
  REMIX_LOGO_CLASS_NAMES,
} from "./styles";
import type { BrandLogoProps } from "./types";

// The logo of a card brand, on a small light badge. It is decorative: whoever shows it also writes
// the brand name.
export function BrandLogo({ brand, size = "sm" }: BrandLogoProps) {
  const remixLogo = REMIX_LOGO_BY_BRAND[brand];

  return (
    <span
      data-brand-logo={brand}
      data-size={size}
      aria-hidden="true"
      className={BADGE_CLASS_NAMES[size]}
    >
      {remixLogo ? (
        <i
          aria-hidden="true"
          className={`${remixLogo} ${REMIX_LOGO_CLASS_NAMES[size]}`}
        />
      ) : (
        <CreditCardIcon className={FALLBACK_ICON_CLASS_NAMES[size]} />
      )}
    </span>
  );
}
