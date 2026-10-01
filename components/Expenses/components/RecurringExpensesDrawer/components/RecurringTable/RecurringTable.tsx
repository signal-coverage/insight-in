import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";

import type { RecurringRow } from "../../../../types";
import { AmountCell } from "./components/AmountCell";
import { DecisionCell } from "./components/DecisionCell";
import {
  AMOUNT_HEADER,
  DAY_HEADER,
  DECISION_HEADER,
  EXPENSE_HEADER,
  LOADING_LABEL,
} from "./consts";
import {
  AMOUNT_COLUMN_CLASS_NAME,
  CATEGORY_CLASS_NAME,
  DAY_COLUMN_CLASS_NAME,
  DECISION_COLUMN_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  EXPENSE_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "./styles";
import type { RecurringTableProps } from "./types";

export function RecurringTable({
  rows,
  choices,
  amounts,
  isDisabled,
  onChoiceChange,
  onAmountChange,
}: RecurringTableProps) {
  const columns: DataTableColumn<RecurringRow>[] = [
    {
      key: "expense",
      header: EXPENSE_HEADER,
      cell: (row) => (
        <span className={EXPENSE_CLASS_NAME}>
          <span className={DESCRIPTION_CLASS_NAME} title={row.description}>
            {row.description}
          </span>
          <span className={CATEGORY_CLASS_NAME}>{row.categoryName}</span>
        </span>
      ),
    },
    {
      key: "day",
      header: DAY_HEADER,
      className: DAY_COLUMN_CLASS_NAME,
      cell: (row) => row.dayLabel,
    },
    {
      key: "amount",
      header: AMOUNT_HEADER,
      className: AMOUNT_COLUMN_CLASS_NAME,
      cell: (row) => (
        <AmountCell
          row={row}
          value={amounts[row.id] ?? row.amountDecimal}
          isDisabled={isDisabled}
          onChange={(value) => onAmountChange(row.id, value)}
        />
      ),
    },
    {
      key: "decision",
      header: DECISION_HEADER,
      className: DECISION_COLUMN_CLASS_NAME,
      cell: (row) => (
        <DecisionCell
          row={row}
          choice={choices[row.id]}
          isDisabled={isDisabled}
          onChange={(choice) => onChoiceChange(row.id, choice)}
        />
      ),
    },
  ];

  return (
    <DataTable
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={[...rows]}
      rowKey={(row) => row.id}
      isLoading={false}
      loadingLabel={LOADING_LABEL}
      emptyState={null}
    />
  );
}
