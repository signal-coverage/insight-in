import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";

import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { EntriesEmptyState } from "@/components/Entries/components/EntriesEmptyState";
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
  ACTIONS_CLASS_NAME,
  ACTIONS_COLUMN_CLASS_NAME,
  ACTION_ICON_CLASS_NAME,
  AMOUNT_COLUMN_CLASS_NAME,
  CENTERED_CLASS_NAME,
  DATE_COLUMN_CLASS_NAME,
  END_ALIGNED_CLASS_NAME,
  NOTES_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "@/components/Entries/tableStyles";

import { EMPTY_COPY } from "../../consts";
import type { TransferRow } from "../../types";
import { transferTitle } from "../../utils";
import {
  ACTIONS_HEADER,
  AMOUNT_HEADER,
  CURRENCY_HEADER,
  DATE_HEADER,
  FROM_HEADER,
  LOADING_LABEL,
  NO_NOTES,
  NOTES_HEADER,
  TABLE_LABEL,
  TO_HEADER,
} from "./consts";
import {
  CURRENCY_COLUMN_CLASS_NAME,
  TRANSFERS_TABLE_CLASS_NAME,
  TRANSFER_ACCOUNT_COLUMN_CLASS_NAME,
} from "./styles";
import type { TransfersTableProps } from "./types";

export function TransfersTable({
  rows,
  isLoading = false,
  isFiltered,
  onAdd,
  onClearFilters,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  deletingIds,
}: TransfersTableProps) {
  // A row being deleted can be neither edited nor deleted again nor ticked.
  const isDeleting = (row: TransferRow) => Boolean(deletingIds?.has(row.id));

  const columns: DataTableColumn<TransferRow>[] = [
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
            aria-label={editLabel(transferTitle(row))}
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
            aria-label={deleteLabel(transferTitle(row))}
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
      key: "date",
      header: DATE_HEADER,
      className: DATE_COLUMN_CLASS_NAME,
      isRowHeader: true,
      cell: (row) => row.dateLabel,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "from",
      header: FROM_HEADER,
      className: TRANSFER_ACCOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={ACCOUNT_CLASS_NAME}>
          {row.fromLabel}
        </TruncatedText>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
    {
      key: "to",
      header: TO_HEADER,
      className: TRANSFER_ACCOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <TruncatedText className={ACCOUNT_CLASS_NAME}>
          {row.toLabel}
        </TruncatedText>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
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
      key: "currency",
      header: CURRENCY_HEADER,
      className: CURRENCY_COLUMN_CLASS_NAME,
      cell: (row) => row.currency,
      loadingCell: <Skeleton className="h-4 w-1/2" />,
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
      tableClassName={TRANSFERS_TABLE_CLASS_NAME}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      loadingLabel={LOADING_LABEL}
      selection={
        onSelectionChange
          ? {
              selectedKeys: selectedIds ?? new Set(),
              onSelectionChange,
              selectAllLabel: SELECT_ALL_LABEL,
              rowLabel: (row) => selectLabel(transferTitle(row)),
            }
          : undefined
      }
      isRowBusy={deletingIds ? isDeleting : undefined}
      busyLabel={DELETING_LABEL}
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
