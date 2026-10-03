import { Card, Skeleton } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import {
  CONTENT_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  EMPHASIS_CLASS_NAME,
  EMPHASIS_VALUE_CLASS_NAME,
  HEADER_CLASS_NAME,
  ITEM_CLASS_NAME,
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
      className={ITEM_CLASS_NAME}
      data-emphasis={emphasis ? "true" : undefined}
      data-tone={tone}
    >
      <Card
        className={cn(
          ROOT_CLASS_NAME,
          tone && TONE_CLASS_NAMES[tone],
          emphasis && EMPHASIS_CLASS_NAME,
        )}
      >
        <Card.Header className={HEADER_CLASS_NAME}>
          <Card.Description
            className={LABEL_CLASS_NAME}
            render={(props) => <span {...props} />}
          >
            {label}
          </Card.Description>
        </Card.Header>
        <Card.Content className={CONTENT_CLASS_NAME}>
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
            <Card.Description className={DESCRIPTION_CLASS_NAME}>
              {description}
            </Card.Description>
          ) : null}
        </Card.Content>
      </Card>
    </li>
  );
}
