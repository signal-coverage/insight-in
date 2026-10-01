import { Button } from "@heroui/react";

import { FIELD_HEIGHT_CLASS_NAME } from "@/components/Entries/styles";
import {
  NEXT_LABEL,
  PAGINATION_ARIA_LABEL,
  PREVIOUS_LABEL,
  pageLabel,
  summaryLabel,
} from "./consts";
import {
  CONTROLS_CLASS_NAME,
  PAGE_LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  SUMMARY_CLASS_NAME,
} from "./styles";
import type { EntriesPaginationProps } from "./types";

export function EntriesPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: EntriesPaginationProps) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className={ROOT_CLASS_NAME} aria-label={PAGINATION_ARIA_LABEL}>
      <p className={SUMMARY_CLASS_NAME}>{summaryLabel(first, last, total)}</p>
      <div className={CONTROLS_CLASS_NAME}>
        <Button
          className={FIELD_HEIGHT_CLASS_NAME}
          variant="tertiary"
          isDisabled={page <= 1}
          onPress={() => onPageChange(page - 1)}
        >
          {PREVIOUS_LABEL}
        </Button>
        <span className={PAGE_LABEL_CLASS_NAME}>
          {pageLabel(page, totalPages)}
        </span>
        <Button
          className={FIELD_HEIGHT_CLASS_NAME}
          variant="tertiary"
          isDisabled={page >= totalPages}
          onPress={() => onPageChange(page + 1)}
        >
          {NEXT_LABEL}
        </Button>
      </div>
    </nav>
  );
}
