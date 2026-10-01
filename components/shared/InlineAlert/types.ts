import type { ReactNode } from "react";

export type InlineAlertVariant = "error" | "success" | "warning";

export interface InlineAlertProps {
  variant: InlineAlertVariant;
  children: ReactNode;
  className?: string;
}
