import type { Source } from "@/components/shared/Await";
import type { AccountChoice } from "@/core/accounts/types";
import type { Transfer } from "@/core/transfers/types";

// A transfer plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or date presentation.
export interface TransferRow extends Transfer {
  // "$ 1.500,50", in the currency of the transfer.
  amountLabel: string;
  // The amount as plain text ("1500.50"), to prefill the form.
  amountDecimal: string;
  // "3 oct 2026".
  dateLabel: string;
}

// What the form drawer is currently showing. The key remounts the form so every opening starts from
// fresh defaults and cleared errors; the date is where a new transfer starts (today, Argentine time).
export interface FormTarget {
  key: number;
  transfer: TransferRow | null;
  defaultDate: string;
}

// What narrows the month's list, applied on the client over the rows of the month.
export interface TransferFilters {
  search: string;
  accountId: string | null;
  currency: string | null;
}

// What the table needs: the month's rows.
export interface TransfersTableData {
  rows: TransferRow[];
}

// Every piece of data is a `Source`: the value itself, or a promise of it while it loads. The page
// renders its structure at once and each section waits only for its own piece.
export interface TransfersProps {
  // The month the list belongs to, "YYYY-MM", and the month in course (where "Mes actual" goes).
  month: string;
  currentMonth: string;
  // The month written out ("Octubre de 2026").
  monthLabel: string;
  table: Source<TransfersTableData>;
  // Every account of the user, for the form and the filters.
  accounts: Source<readonly AccountChoice[]>;
}
