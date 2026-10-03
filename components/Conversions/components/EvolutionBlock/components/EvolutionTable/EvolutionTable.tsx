import { EVOLUTION } from "@/components/Conversions/consts";
import type { EvolutionRowView } from "@/components/Conversions/types";
import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";

import {
  END_ALIGNED_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
  NUMBER_COLUMN_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "./styles";
import type { EvolutionTableProps } from "./types";

// A pair's rate month by month: the month, its weighted rate and how far it moved from the month
// before.
export function EvolutionTable({ label, rows }: EvolutionTableProps) {
  const columns: DataTableColumn<EvolutionRowView>[] = [
    {
      key: "month",
      header: EVOLUTION.monthHeader,
      isRowHeader: true,
      cell: (row) => row.month,
    },
    {
      key: "rate",
      header: EVOLUTION.rateHeader,
      className: NUMBER_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (row) => row.rate,
    },
    {
      key: "variation",
      header: EVOLUTION.variationHeader,
      className: NUMBER_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (row) => row.variation,
    },
  ];

  return (
    <DataTable
      label={label}
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.month}
      isLoading={false}
      loadingLabel={EVOLUTION.loadingLabel}
      emptyState={null}
    />
  );
}
