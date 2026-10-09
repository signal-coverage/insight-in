import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { EntriesEmptyState } from "@/components/Entries/components/EntriesEmptyState";
import { InstallmentMarker } from "@/components/Entries/components/InstallmentMarker";
import { MarkerIcon } from "@/components/Entries/components/MarkerIcon";
import { StatusCheckbox } from "@/components/Entries/components/StatusCheckbox";
import { MARKERS, ORIGIN_MARKER_ICON } from "@/components/Entries/markers";
import { TruncatedText } from "@/components/Entries/components/TruncatedText";
import {
  DELETING_LABEL,
  SELECT_ALL_LABEL,
  deleteLabel,
  editLabel,
  selectLabel,
} from "@/components/Entries/consts";
import {
  ACCOUNT_CLASS_NAME,
  ACCOUNT_COLUMN_CLASS_NAME,
  ACTIONS_CLASS_NAME,
  ACTIONS_COLUMN_CLASS_NAME,
  ACTION_ICON_CLASS_NAME,
  AMOUNT_COLUMN_CLASS_NAME,
  CENTERED_CELL_CLASS_NAME,
  CATEGORY_COLUMN_CLASS_NAME,
  CENTERED_CLASS_NAME,
  COVERED_ICON_CLASS_NAME,
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
  COVERED_MARKER_LABEL,
  EMPTY_COPY,
  RECURRING_MARKER_LABEL,
  REIMBURSEMENT_MARKER_LABEL,
  markSettledLabel,
} from "../../consts";
import type { ExpenseRow } from "../../types";
import {
  ACCOUNT_HEADER,
  ACTIONS_HEADER,
  AMOUNT_HEADER,
  CATEGORY_HEADER,
  DATE_HEADER,
  DESCRIPTION_HEADER,
  LOADING_LABEL,
  NO_NOTES,
  NOTES_HEADER,
  STATUS_HEADER,
  TABLE_LABEL,
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
  selectedIds,
  onSelectionChange,
  deletingIds,
}: ExpensesTableProps) {
  // A row being deleted can be neither edited nor deleted again nor ticked.
  const isDeleting = (row: ExpenseRow) => Boolean(deletingIds?.has(row.id));

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
            variant="secondary"
            aria-label={editLabel(row.description)}
            isDisabled={isDeleting(row)}
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
            isDisabled={isDeleting(row)}
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
          {row.status === "COVERED" ? (
            // Someone else paid it: nothing to tick, so the marker stands in for the checkbox.
            <MarkerIcon
              icon={MARKERS.covered.icon}
              label={COVERED_MARKER_LABEL}
              className={COVERED_ICON_CLASS_NAME}
            />
          ) : (
            <StatusCheckbox
              isSettled={row.status === "SETTLED"}
              label={markSettledLabel(row.description)}
              isDisabled={isDeleting(row)}
              onChange={(isSettled) => onToggleStatus(row, isSettled)}
            />
          )}
        </div>
      ),
      loadingCell: <Skeleton className="mx-auto size-5 rounded-md" />,
    },
    {
      key: "description",
      header: DESCRIPTION_HEADER,
      sortable: true,
      isRowHeader: true,
      cell: (row) => (
        <span className={DESCRIPTION_ROW_CLASS_NAME}>
          <TruncatedText className={DESCRIPTION_CLASS_NAME}>
            {row.description}
          </TruncatedText>
          {row.installmentPlanId !== null ? <InstallmentMarker /> : null}
          {row.isRecurring ? (
            <MarkerIcon
              icon={MARKERS.recurring.icon}
              label={RECURRING_MARKER_LABEL}
              className={RECURRING_ICON_CLASS_NAME}
            />
          ) : null}
          {/* It was quoted in another currency: the marker only records the reference price. */}
          {row.originLabel !== null ? (
            <MarkerIcon
              icon={ORIGIN_MARKER_ICON}
              label={row.originLabel}
              tooltip={row.originTooltip ?? row.originLabel}
              className={RECURRING_ICON_CLASS_NAME}
            />
          ) : null}
          {/* It is expected to be paid back: the tooltip says how much is still owed. */}
          {row.reimbursementTooltip !== null ? (
            <MarkerIcon
              icon={MARKERS.reimbursement.icon}
              label={REIMBURSEMENT_MARKER_LABEL}
              tooltip={row.reimbursementTooltip}
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
      key: "account",
      header: ACCOUNT_HEADER,
      className: ACCOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={ACCOUNT_CLASS_NAME}>
          {row.accountLabel}
        </TruncatedText>
      ),
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
          <TruncatedText className={NOTES_CLASS_NAME}>
            {row.notes}
          </TruncatedText>
        ) : (
          <span className={NOTES_CLASS_NAME}>{NO_NOTES}</span>
        ),
      loadingCell: <Skeleton className="h-4 w-2/3" />,
    },
  ];

  return (
    <DataTable
      label={TABLE_LABEL}
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingLabel={LOADING_LABEL}
      sort={sort}
      onSortChange={onSortChange}
      selection={
        onSelectionChange
          ? {
              selectedKeys: selectedIds ?? new Set(),
              onSelectionChange,
              selectAllLabel: SELECT_ALL_LABEL,
              rowLabel: (row) => selectLabel(row.description),
            }
          : undefined
      }
      isRowBusy={deletingIds ? isDeleting : undefined}
      busyLabel={DELETING_LABEL}
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
