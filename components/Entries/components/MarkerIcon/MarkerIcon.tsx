import { Tooltip } from "@heroui/react";
import type { ComponentProps } from "react";

import type { MarkerIconProps } from "./types";

// A small icon that carries a meaning next to a value (cash, installment, recurring, covered): an
// image with an accessible name, and the same text as a tooltip on hover and on keyboard focus.
// The icon itself is the tooltip trigger, so it stays the only tab stop.
export function MarkerIcon({
  icon: Icon,
  label,
  tooltip = label,
  className,
}: MarkerIconProps) {
  return (
    <Tooltip>
      <Tooltip.Trigger<"svg">
        className={className}
        render={(props) => (
          <Icon
            {...(props as ComponentProps<typeof Icon>)}
            // Heroicons are aria-hidden by default: this one carries the meaning, so it must not be.
            role="img"
            aria-hidden={false}
            aria-label={label}
          />
        )}
      />
      <Tooltip.Content>{tooltip}</Tooltip.Content>
    </Tooltip>
  );
}
