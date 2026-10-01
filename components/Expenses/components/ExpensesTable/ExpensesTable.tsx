import {
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { EntriesEmptyState } from "@/components/Entries/components/EntriesEmptyState";
import { StatusCheckbox } from "@/components/Entries/components/StatusCheckbox";
import { deleteLabel, editLabel } from "@/components/Entries/consts";
import {
  ACTIONS_CLASS_NAME,
  ACTIONS_COLUMN_CLASS_NAME,
  ACTION_ICON_CLASS_NAME,
  AMOUNT_COLUMN_CLASS_NAME,
  CENTERED_CELL_CLASS_NAME,
  CATEGORY_COLUMN_CLASS_NAME,
  CENTERED_CLASS_NAME,
  DATE_COLUMN_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  DESCRIPTION_ROW_CLASS_NAME,
  END_ALIGNED_CLASS_NAME,
  NOTES_CLASS_NAME,
  RECURRING_ICON_CLASS_NAME,
  STATUS_COLUMN_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "@/components/Entries/tableStyles";

import {
  EMPTY_COPY,
  RECURRING_MARKER_LABEL,
  markSettledLabel,
} from "../../consts";
import type { ExpenseRow } from "../../types";
import {
  ACTIONS_HEADER,
  AMOUNT_HEADER,
  CATEGORY_HEADER,
  DATE_HEADER,
  DESCRIPTION_HEADER,
  LOADING_LABEL,
  NO_NOTES,
  NOTES_HEADER,
  STATUS_HEADER,
} from "./consts";
import type { ExpensesTableProps } from "./types";

export function ExpensesTable({
  rows,
  isLoading = false,
  isFiltered,
  sort,
  onSortChange,
  footer,
  onAdd,
  onClearFilters,
  onEdit,
  onDelete,
  onToggleStatus,
}: ExpensesTableProps) {
  const columns: DataTableColumn<ExpenseRow>[] = [
    {
      key: "actions",
      header: ACTIONS_HEADER,
      className: ACTIONS_COLUMN_CLASS_NAME,
      headerClassName: CENTERED_CLASS_NAME,
      cell: (row) => (
        <div className={ACTIONS_CLASS_NAME}>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            aria-label={editLabel(row.description)}
            onPress={() => onEdit(row)}
          >
            <PencilSquareIcon
              className={ACTION_ICON_CLASS_NAME}
              aria-hidden="true"
            />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="danger-soft"
            aria-label={deleteLabel(row.description)}
            onPress={() => onDelete(row)}
          >
            <TrashIcon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
          </Button>
        </div>
      ),
      loadingCell: (
        <div className={ACTIONS_CLASS_NAME}>
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      ),
    },
    {
      key: "status",
      header: STATUS_HEADER,
      className: STATUS_COLUMN_CLASS_NAME,
      headerClassName: CENTERED_CLASS_NAME,
      cell: (row) => (
        <div className={CENTERED_CELL_CLASS_NAME}>
          <StatusCheckbox
            isSettled={row.status === "SETTLED"}
            label={markSettledLabel(row.description)}
            onChange={(isSettled) => onToggleStatus(row, isSettled)}
          />
        </div>
      ),
      loadingCell: <Skeleton className="mx-auto size-5 rounded-md" />,
    },
    {
      key: "description",
      header: DESCRIPTION_HEADER,
      sortable: true,
      cell: (row) => (
        <span className={DESCRIPTION_ROW_CLASS_NAME}>
          <span className={DESCRIPTION_CLASS_NAME} title={row.description}>
            {row.description}
          </span>
          {row.isRecurring ? (
            // Heroicons are aria-hidden by default: this one carries the meaning, so it must not be.
            <ArrowPathIcon
              role="img"
              aria-hidden={false}
              aria-label={RECURRING_MARKER_LABEL}
              title={RECURRING_MARKER_LABEL}
              className={RECURRING_ICON_CLASS_NAME}
            />
          ) : null}
        </span>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
    {
      key: "category",
      header: CATEGORY_HEADER,
      className: CATEGORY_COLUMN_CLASS_NAME,
      sortable: true,
      cell: (row) => row.categoryName,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "date",
      header: DATE_HEADER,
      className: DATE_COLUMN_CLASS_NAME,
      sortable: true,
      // Dates are read newest first, so a fresh click on Date starts descending.
      defaultSortDirection: "desc",
      cell: (row) => row.dateLabel,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "amount",
      header: AMOUNT_HEADER,
      className: AMOUNT_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (row) => row.amountLabel,
      loadingCell: <Skeleton className="ml-auto h-4 w-3/4" />,
    },
    {
      key: "notes",
      header: NOTES_HEADER,
      cell: (row) =>
        row.notes ? (
          <span className={NOTES_CLASS_NAME} title={row.notes}>
            {row.notes}
          </span>
        ) : (
          <span className={NOTES_CLASS_NAME}>{NO_NOTES}</span>
        ),
      loadingCell: <Skeleton className="h-4 w-2/3" />,
    },
  ];

  return (
    <DataTable
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingLabel={LOADING_LABEL}
      sort={sort}
      onSortChange={onSortChange}
      footer={footer}
      emptyState={
        <EntriesEmptyState
          copy={EMPTY_COPY}
          variant={isFiltered ? "filtered" : "empty"}
          onAction={isFiltered ? onClearFilters : onAdd}
        />
      }
    />
  );
}
