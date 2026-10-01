import { Button } from "@heroui/react";

import { InlineAlert } from "@/components/shared/InlineAlert";

import { pendingMessage, RESOLVE_LABEL } from "./consts";
import { CONTENT_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { RecurringNoticeProps } from "./types";

// Sits above the expenses table while the current month has recurring expenses nobody has
// decided about yet, and opens the wizard that resolves them.
export function RecurringNotice({
  pendingCount,
  onResolve,
}: RecurringNoticeProps) {
  if (pendingCount === 0) {
    return null;
  }

  return (
    <InlineAlert variant="warning" className={ROOT_CLASS_NAME}>
      <span className={CONTENT_CLASS_NAME}>
        <span>{pendingMessage(pendingCount)}</span>
        <Button size="sm" variant="secondary" onPress={onResolve}>
          {RESOLVE_LABEL}
        </Button>
      </span>
    </InlineAlert>
  );
}
