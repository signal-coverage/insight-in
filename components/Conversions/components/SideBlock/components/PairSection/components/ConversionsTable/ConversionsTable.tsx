import { DataTable } from "@/components/DataTable";
import type { DataTableColumn } from "@/components/DataTable";
import { TruncatedText } from "@/components/Entries/components/TruncatedText";

import { SIDE_COPY, TABLE_HEADERS } from "@/components/Conversions/consts";
import type { ItemView } from "@/components/Conversions/types";

import {
  DATE_COLUMN_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  END_ALIGNED_CLASS_NAME,
  FIXED_TABLE_CLASS_NAME,
  AMOUNT_COLUMN_CLASS_NAME,
  RATE_COLUMN_CLASS_NAME,
  TABLE_CLASS_NAME,
} from "./styles";
import type { ConversionsTableProps } from "./types";
import { tableLabel } from "./utils";

// Each conversion of the month, newest first: when, what, what was sent (or priced), what arrived
// (or was paid) and the rate that implies. The amounts are already text in their own currencies.
export function ConversionsTable({ pair }: ConversionsTableProps) {
  const copy = SIDE_COPY[pair.side];

  const columns: DataTableColumn<ItemView>[] = [
    {
      key: "date",
      header: TABLE_HEADERS.date,
      className: DATE_COLUMN_CLASS_NAME,
      cell: (item) => item.date,
    },
    {
      key: "description",
      header: TABLE_HEADERS.description,
      isRowHeader: true,
      cell: (item) => (
        <TruncatedText className={DESCRIPTION_CLASS_NAME}>
          {item.description}
        </TruncatedText>
      ),
    },
    {
      key: "origin",
      header: copy.originLabel,
      className: AMOUNT_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (item) => item.origin,
    },
    {
      key: "net",
      header: copy.netLabel,
      className: AMOUNT_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (item) => item.net,
    },
    {
      key: "rate",
      header: TABLE_HEADERS.rate,
      className: RATE_COLUMN_CLASS_NAME,
      headerClassName: END_ALIGNED_CLASS_NAME,
      cell: (item) => item.rate,
    },
  ];

  return (
    <DataTable
      label={tableLabel(pair)}
      className={TABLE_CLASS_NAME}
      tableClassName={FIXED_TABLE_CLASS_NAME}
      columns={columns}
      rows={pair.items}
      rowKey={(item) => item.id}
      isLoading={false}
      loadingLabel={tableLabel(pair)}
      emptyState={null}
    />
  );
}
