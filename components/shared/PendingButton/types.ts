import type { Button } from "@heroui/react";
import type { ComponentProps, ComponentType } from "react";

type HeroButtonProps = ComponentProps<typeof Button>;

// Every HeroUI button prop (variant, size, type, form, slot, onPress, isDisabled, ...) except the
// content and the pending flag, which this component owns.
export interface PendingButtonProps extends Omit<
  HeroButtonProps,
  "children" | "isPending"
> {
  isPending?: boolean;
  // Shown before the label while idle, and replaced by a spinner while pending. Only actions that
  // create something need one (the "+"); saving an edit or confirming a delete do not.
  Icon?: ComponentType<{
    className?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;
  label: string;
  // What the button says while the action is in flight (e.g. "Adding…"). Optional: without it the
  // button keeps its own label and the spinner alone shows that it is working.
  pendingLabel?: string;
}
