import { Pagination } from "@heroui/react";

import {
  NEXT_LABEL,
  PAGINATION_ARIA_LABEL,
  PREVIOUS_LABEL,
  pageLabel,
  summaryLabel,
} from "./consts";
import {
  PAGE_LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  SECTION_CLASS_NAME,
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
    <Pagination className={ROOT_CLASS_NAME} aria-label={PAGINATION_ARIA_LABEL}>
      <Pagination.Summary className={SECTION_CLASS_NAME}>
        {summaryLabel(first, last, total)}
      </Pagination.Summary>
      <Pagination.Content className={SECTION_CLASS_NAME}>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={page <= 1}
            onPress={() => onPageChange(page - 1)}
          >
            <Pagination.PreviousIcon />
            {PREVIOUS_LABEL}
          </Pagination.Previous>
        </Pagination.Item>
        <Pagination.Item>
          <span className={PAGE_LABEL_CLASS_NAME}>
            {pageLabel(page, totalPages)}
          </span>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next
            isDisabled={page >= totalPages}
            onPress={() => onPageChange(page + 1)}
          >
            {NEXT_LABEL}
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
