import { Chip, Tooltip } from "@heroui/react";

import { TIER_COLORS, TIER_ICONS, TIER_LABELS, TIER_MEANINGS } from "./consts";
import {
  ICON_CLASS_NAME,
  TIER_CLASS_NAMES,
  TRIGGER_CLASS_NAME,
} from "./styles";
import type { TierChipProps } from "./types";

// How close a card is to its cap, as a text chip with an icon of its own for each tier. Hovering or
// focusing the chip says what the tier means in numbers; the chip itself is the one tab stop.
export function TierChip({ tier }: TierChipProps) {
  const Icon = TIER_ICONS[tier];

  return (
    <Tooltip>
      <Tooltip.Trigger<"span">
        className={TRIGGER_CLASS_NAME}
        render={(props) => <span {...props} role={undefined} tabIndex={0} />}
      >
        <Chip
          size="sm"
          variant="soft"
          color={TIER_COLORS[tier]}
          className={TIER_CLASS_NAMES[tier]}
        >
          <Icon
            data-tier={tier}
            className={ICON_CLASS_NAME}
            aria-hidden="true"
          />
          <Chip.Label>{TIER_LABELS[tier]}</Chip.Label>
        </Chip>
      </Tooltip.Trigger>
      <Tooltip.Content>{TIER_MEANINGS[tier]}</Tooltip.Content>
    </Tooltip>
  );
}
