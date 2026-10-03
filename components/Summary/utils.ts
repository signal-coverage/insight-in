import type { OpeningBalanceEditorData } from "@/core/balances/types";
import type { PaymentMedium } from "@/core/entries/medium";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import type { CurrencySummary, SideSummary } from "@/core/summary/types";

import type {
  OpeningBalanceData,
  OpeningBalanceRow,
} from "./components/OpeningBalanceDrawer";
import type { SideRow, SummaryRow } from "./types";

const toSideRow = (side: SideSummary, currency: string): SideRow => ({
  total: formatMoney(side.total, currency),
  settled: formatMoney(side.settled, currency),
  pending: formatMoney(side.pending, currency),
});

// Money is formatted on the server, in each row's own currency, so the client only places text.
export const toSummaryRows = (
  summary: readonly CurrencySummary[],
): SummaryRow[] =>
  summary.map(
    ({
      currency,
      incomes,
      expenses,
      previous,
      current,
      target,
      wallet,
      available,
      pendingReimbursements,
    }) => ({
      currency,
      incomes: toSideRow(incomes, currency),
      expenses: toSideRow(expenses, currency),
      previous: formatMoney(previous, currency),
      current: formatMoney(current, currency),
      target: formatMoney(target, currency),
      wallet: formatMoney(wallet, currency),
      available: formatMoney(available, currency),
      reimbursements: formatMoney(pendingReimbursements, currency),
    }),
  );

// What the opening balance editor starts from: a row per currency it offers, each amount as plain
// decimal text for its input, or empty when none is saved.
export const toOpeningBalanceData = ({
  opening,
  currencies,
}: OpeningBalanceEditorData): OpeningBalanceData => {
  const amountOf = (currency: string, medium: PaymentMedium): string => {
    const saved = opening?.amounts.find(
      (amount) => amount.currency === currency && amount.medium === medium,
    );

    return saved ? toDecimalString(saved.amount, currency) : "";
  };

  return {
    month: opening?.month ?? null,
    rows: currencies.map((currency): OpeningBalanceRow => ({
      currency,
      digital: amountOf(currency, "DIGITAL"),
      cash: amountOf(currency, "CASH"),
    })),
  };
};
