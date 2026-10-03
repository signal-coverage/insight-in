import { Tooltip } from "@heroui/react";

import type { TruncatedTextProps } from "./types";

// Text that may be cut with an ellipsis. Its full text is a tooltip on hover and on keyboard focus,
// so the text itself is focusable (`tabIndex`), and it stays the only tab stop.
export function TruncatedText({
  children,
  className,
  testId,
}: TruncatedTextProps) {
  return (
    <Tooltip>
      <Tooltip.Trigger<"span">
        className={className}
        render={(props) => (
          <span {...props} role={undefined} tabIndex={0} data-testid={testId} />
        )}
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content>{children}</Tooltip.Content>
    </Tooltip>
  );
}
