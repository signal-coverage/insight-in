import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/Entries/components/TruncatedText";

import type { InstallmentPlanRow } from "@/components/Entries/types";

import { CountCell } from "./components/CountCell";
import { AMOUNT_HEADER, COUNT_HEADER, PROGRESS_HEADER } from "./consts";
import {
  AMOUNT_COLUMN_CLASS_NAME,
  CATEGORY_CLASS_NAME,
  COUNT_COLUMN_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
  PROGRESS_COLUMN_CLASS_NAME,
  PURCHASE_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "./styles";
import type { InstallmentsTableProps } from "./types";

// The plans in installments (purchases to pay, loans to collect) that still have something left,
// each with how many of its installments the user takes this month.
export function InstallmentsTable({
  copy,
  rows,
  counts,
  isDisabled,
  onCountChange,
}: InstallmentsTableProps) {
  const columns: DataTableColumn<InstallmentPlanRow>[] = [
    {
      key: "purchase",
      header: copy.purchaseHeader,
      isRowHeader: true,
      cell: (row) => (
        <span className={PURCHASE_CLASS_NAME}>
          <TruncatedText className={DESCRIPTION_CLASS_NAME}>
            {row.description}
          </TruncatedText>
          <span className={CATEGORY_CLASS_NAME}>{row.categoryName}</span>
        </span>
      ),
    },
    {
      key: "progress",
      header: PROGRESS_HEADER,
      className: PROGRESS_COLUMN_CLASS_NAME,
      cell: (row) => row.progressLabel,
    },
    {
      key: "amount",
      header: AMOUNT_HEADER,
      className: AMOUNT_COLUMN_CLASS_NAME,
      cell: (row) => row.nextAmountLabel,
    },
    {
      key: "count",
      header: COUNT_HEADER,
      className: COUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <CountCell
          row={row}
          value={counts[row.id] ?? row.defaultCount}
          isDisabled={isDisabled}
          onChange={(value) => onCountChange(row.id, value)}
        />
      ),
    },
  ];

  return (
    <DataTable
      label={copy.tableLabel}
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={[...rows]}
      rowKey={(row) => row.id}
      isLoading={false}
      loadingLabel={copy.loadingLabel}
      emptyState={null}
    />
  );
}
