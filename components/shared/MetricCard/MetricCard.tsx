import { Skeleton } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import {
  DESCRIPTION_CLASS_NAME,
  EMPHASIS_CLASS_NAME,
  EMPHASIS_VALUE_CLASS_NAME,
  LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  SKELETON_CLASS_NAME,
  TONE_CLASS_NAMES,
  VALUE_CLASS_NAME,
} from "./styles";
import type { MetricCardProps } from "./types";

// One figure of a bar of totals: a small label over an amount. It is a list item, so a row of
// them is a list that assistive technology can read as one.
export function MetricCard({
  label,
  value,
  isLoading = false,
  emphasis = false,
  tone,
  description,
}: MetricCardProps) {
  return (
    <li
      className={cn(
        ROOT_CLASS_NAME,
        tone && TONE_CLASS_NAMES[tone],
        emphasis && EMPHASIS_CLASS_NAME,
      )}
      data-emphasis={emphasis ? "true" : undefined}
      data-tone={tone}
    >
      <span className={LABEL_CLASS_NAME}>{label}</span>
      {isLoading ? (
        <Skeleton className={SKELETON_CLASS_NAME} />
      ) : (
        <span
          className={cn(
            VALUE_CLASS_NAME,
            emphasis && EMPHASIS_VALUE_CLASS_NAME,
          )}
        >
          {value}
        </span>
      )}
      {description ? (
        <span className={DESCRIPTION_CLASS_NAME}>{description}</span>
      ) : null}
    </li>
  );
}
