import { cn } from "@/lib/utils/utils";

import { ICONS } from "./consts";
import {
  ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
  VARIANT_CLASS_NAMES,
} from "./styles";
import type { InlineAlertProps } from "./types";

// Errors interrupt (role="alert"); success and warning are polite status messages.
export function InlineAlert({
  variant,
  children,
  className,
}: InlineAlertProps) {
  const Icon = ICONS[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(ROOT_CLASS_NAME, VARIANT_CLASS_NAMES[variant], className)}
    >
      <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
