import { Button, Spinner } from "@heroui/react";

import { ICON_CLASS_NAME } from "./styles";
import type { PendingButtonProps } from "./types";

// The app's button for anything that waits on something (a save, a delete, an add). HeroUI's own
// `isPending` only blocks presses and shows nothing, so this wraps it with the behaviour every such
// button should have by default: a spinner in place of the icon, and the pending label (or, without
// one, the same label) while it works. Use it instead of `<Button isPending>`: a test
// (pendingButtonUsage.test.ts) fails if a raw HeroUI Button sets `isPending`.
export function PendingButton({
  isPending = false,
  Icon,
  label,
  pendingLabel,
  ...buttonProps
}: PendingButtonProps) {
  return (
    <Button {...buttonProps} isPending={isPending}>
      {({ isPending: pending }) => (
        <>
          {pending ? (
            <Spinner color="current" size="sm" />
          ) : Icon ? (
            <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
          ) : null}
          {pending ? (pendingLabel ?? label) : label}
        </>
      )}
    </Button>
  );
}
