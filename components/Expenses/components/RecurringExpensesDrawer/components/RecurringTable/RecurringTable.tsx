import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/Entries/components/TruncatedText";
import { InlineAlert } from "@/components/shared/InlineAlert";

import type { RecurringRow } from "../../../../types";
import { AmountCell } from "./components/AmountCell";
import { DecisionCell } from "./components/DecisionCell";
import { RowActions } from "./components/RowActions";
import {
  ACTIONS_HEADER,
  AMOUNT_HEADER,
  DAY_HEADER,
  DECISION_HEADER,
  EXPENSE_HEADER,
  LOADING_LABEL,
  TABLE_LABEL,
} from "./consts";
import {
  ACTIONS_COLUMN_CLASS_NAME,
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
  rowErrors,
  isDisabled,
  onChoiceChange,
  onAmountChange,
  onEdit,
  onRemove,
  onDisable,
  onRowError,
}: RecurringTableProps) {
  const columns: DataTableColumn<RecurringRow>[] = [
    {
      key: "actions",
      header: ACTIONS_HEADER,
      className: ACTIONS_COLUMN_CLASS_NAME,
      cell: (row) => (
        <RowActions
          row={row}
          isDisabled={isDisabled}
          onEdit={onEdit}
          onRemove={onRemove}
          onDisable={onDisable}
          onError={onRowError}
        />
      ),
    },
    {
      key: "expense",
      header: EXPENSE_HEADER,
      isRowHeader: true,
      cell: (row) => (
        <span className={EXPENSE_CLASS_NAME}>
          <TruncatedText className={DESCRIPTION_CLASS_NAME}>
            {row.description}
          </TruncatedText>
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
          // The amount does not matter for a row that is going to be removed.
          isDisabled={isDisabled || choices[row.id] === "remove"}
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
      label={TABLE_LABEL}
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={[...rows]}
      rowKey={(row) => row.id}
      isLoading={false}
      loadingLabel={LOADING_LABEL}
      emptyState={null}
      rowNote={(row) =>
        rowErrors[row.id] ? (
          <InlineAlert variant="error">{rowErrors[row.id]}</InlineAlert>
        ) : null
      }
    />
  );
}
