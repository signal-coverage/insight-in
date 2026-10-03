import { Alert } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import { STATUSES } from "./consts";
import {
  CONTENT_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  INDICATOR_CLASS_NAME,
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
  return (
    <Alert
      role={variant === "error" ? "alert" : "status"}
      status={STATUSES[variant]}
      className={cn(ROOT_CLASS_NAME, VARIANT_CLASS_NAMES[variant], className)}
    >
      <Alert.Indicator className={INDICATOR_CLASS_NAME} />
      <Alert.Content className={CONTENT_CLASS_NAME}>
        <Alert.Description className={DESCRIPTION_CLASS_NAME}>
          {children}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
