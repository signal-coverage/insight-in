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
  ACTIONS_CLASS_NAME,
  ACTIONS_COLUMN_CLASS_NAME,
  ACTION_ICON_CLASS_NAME,
  CENTERED_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  END_ALIGNED_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "@/components/Entries/tableStyles";

import { EMPTY_COPY } from "../../consts";
import type { CardRow } from "../../types";
import { BrandLogo } from "../BrandLogo";
import { UsageCell } from "./components/UsageCell";
import {
  ACTIONS_HEADER,
  AVAILABLE_HEADER,
  CARD_HEADER,
  CLOSING_HEADER,
  DUE_HEADER,
  LIMIT_HEADER,
  LOADING_LABEL,
  TABLE_LABEL,
  USAGE_HEADER,
} from "./consts";
import {
  AVAILABLE_COLUMN_CLASS_NAME,
  CARD_CELL_CLASS_NAME,
  CLOSING_COLUMN_CLASS_NAME,
  DUE_COLUMN_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
  LIMIT_COLUMN_CLASS_NAME,
  USAGE_COLUMN_CLASS_NAME,
  USAGE_SKELETON_CLASS_NAME,
} from "./styles";
import type { CardsTableProps } from "./types";

export function CardsTable({
  rows,
  isLoading = false,
  onAdd,
  onEdit,
  onDelete,
  selectedIds,
  onSelectionChange,
  deletingIds,
}: CardsTableProps) {
  // A row being deleted can be neither edited nor deleted again nor ticked.
  const isDeleting = (row: CardRow) => Boolean(deletingIds?.has(row.id));

  const columns: DataTableColumn<CardRow>[] = [
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
            aria-label={editLabel(row.title)}
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
            aria-label={deleteLabel(row.title)}
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
      key: "card",
      header: CARD_HEADER,
      isRowHeader: true,
      cell: (row) => (
        <div className={CARD_CELL_CLASS_NAME}>
          <BrandLogo brand={row.brand} />
          <TruncatedText className={DESCRIPTION_CLASS_NAME}>
            {row.title}
          </TruncatedText>
        </div>
      ),
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
    {
      key: "closing",
      header: CLOSING_HEADER,
      className: CLOSING_COLUMN_CLASS_NAME,
      cell: (row) => row.closingLabel,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "due",
      header: DUE_HEADER,
      className: DUE_COLUMN_CLASS_NAME,
      cell: (row) => row.dueLabel,
      loadingCell: <Skeleton className="h-4 w-3/4" />,
    },
    {
      key: "limit",
      header: LIMIT_HEADER,
      className: LIMIT_COLUMN_CLASS_NAME,
      cell: (row) => row.limitLabel,
      loadingCell: <Skeleton className="h-4 w-4/5" />,
    },
    {
      key: "usage",
      header: USAGE_HEADER,
      className: USAGE_COLUMN_CLASS_NAME,
      cell: (row) => <UsageCell row={row} />,
      loadingCell: (
        <div className={USAGE_SKELETON_CLASS_NAME}>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ),
    },
    {
      key: "available",
      header: AVAILABLE_HEADER,
      className: AVAILABLE_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (row) => row.availableLabel,
      loadingCell: <Skeleton className="ml-auto h-4 w-3/4" />,
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
      selection={
        onSelectionChange
          ? {
              selectedKeys: selectedIds ?? new Set(),
              onSelectionChange,
              selectAllLabel: SELECT_ALL_LABEL,
              rowLabel: (row) => selectLabel(row.title),
            }
          : undefined
      }
      isRowBusy={deletingIds ? isDeleting : undefined}
      busyLabel={DELETING_LABEL}
      emptyState={
        <EntriesEmptyState copy={EMPTY_COPY} variant="empty" onAction={onAdd} />
      }
    />
  );
}
