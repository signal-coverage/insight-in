import { normalizeSearch } from "@/core/banks/board";
import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import type { Transfer } from "@/core/transfers/types";

import type { TransferFilters, TransferRow } from "./types";

// Money and dates are formatted on the server so the client never re-derives presentation.
export const toTransferRows = (transfers: readonly Transfer[]): TransferRow[] =>
  transfers.map((transfer) => ({
    ...transfer,
    amountLabel: formatMoney(transfer.amount, transfer.currency),
    amountDecimal: toDecimalString(transfer.amount, transfer.currency),
    dateLabel: formatIncomeDate(transfer.date),
  }));

// The accessible name of the buttons of a row.
export const transferTitle = (row: TransferRow): string =>
  `Transferencia de ${row.fromLabel} a ${row.toLabel}`;

export const hasActiveFilters = ({
  search,
  accountId,
  currency,
}: TransferFilters): boolean =>
  normalizeSearch(search) !== "" || accountId !== null || currency !== null;

// The rows the table shows: the month's rows narrowed by the filters. The search looks at both
// accounts ("Banco · Cuenta") and the notes, ignoring case and accents; the account filter matches
// either side; the currency is the one of the transfer. The input is never changed.
export const filterTransfers = (
  rows: readonly TransferRow[],
  { search, accountId, currency }: TransferFilters,
): TransferRow[] => {
  const needle = normalizeSearch(search);

  return rows.filter((row) => {
    if (
      accountId !== null &&
      row.fromAccountId !== accountId &&
      row.toAccountId !== accountId
    ) {
      return false;
    }

    if (currency !== null && row.currency !== currency) {
      return false;
    }

    return (
      needle === "" ||
      [row.fromLabel, row.toLabel, row.notes ?? ""].some((text) =>
        normalizeSearch(text).includes(needle),
      )
    );
  });
};
