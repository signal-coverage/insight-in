import { ProgressBar } from "@heroui/react";

import { TruncatedText } from "@/components/Entries/components/TruncatedText";
import { cn } from "@/lib/utils/utils";

import { TierChip } from "./components/TierChip";
import { usageAriaLabel } from "./consts";
import {
  BAR_CLASS_NAME,
  BAR_TIER_CLASS_NAMES,
  FOOTER_CLASS_NAME,
  ROOT_CLASS_NAME,
  USED_CLASS_NAME,
} from "./styles";
import type { UsageCellProps } from "./types";

// What a card has used of one of its caps: the amounts, a bar as full as that share, and the tier
// in words.
export function UsageCell({ title, limit }: UsageCellProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <TruncatedText className={USED_CLASS_NAME}>
        {limit.usedLabel}
      </TruncatedText>
      <div className={FOOTER_CLASS_NAME}>
        <ProgressBar
          aria-label={usageAriaLabel(title, limit.currency)}
          size="sm"
          value={limit.percent}
          className={cn(BAR_CLASS_NAME, BAR_TIER_CLASS_NAMES[limit.tier])}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        <TierChip tier={limit.tier} />
      </div>
    </div>
  );
}
