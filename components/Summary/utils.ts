import type { OpeningBalanceEditorData } from "@/core/balances/types";
import { BANKS_PATH } from "@/core/banks/consts";
import { CARDS_PATH } from "@/core/cards/consts";
import { compareCurrencyCodes } from "@/core/currencies/crypto";
import {
  DEFAULT_ENTRIES_QUERY,
  serializeEntriesQuery,
} from "@/core/entries/query";
import { EXPENSES_PATH } from "@/core/expenses/consts";
import { INCOMES_PATH } from "@/core/incomes/consts";
import { formatIncomeDate, formatShortDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import { ATTENTION_DAYS_AHEAD } from "@/core/summary/consts";
import { addDays } from "@/core/summary/days";
import type { CurrencyAccounts } from "@/core/summary/groupAccounts";
import { formatShortMonth } from "@/core/summary/month";
import type {
  AttentionGroup,
  AttentionKind,
  CurrencySummary,
  MonthCharts,
  SideSummary,
} from "@/core/summary/types";

import type {
  OpeningBalanceData,
  OpeningBankGroup,
} from "./components/OpeningBalanceDrawer";
// By path, not through the drawer's barrel: the barrel brings in the client drawer and the save
// action (and the database client behind it), which a server-side mapping must not load.
import { openingRowLabel } from "./components/OpeningBalanceDrawer/rowLabel";
import { ATTENTION_COPY, OTHER_CATEGORY_KEY } from "./consts";
import type {
  AttentionGroupRow,
  BlockResult,
  CurrencyAccountsRow,
  CurrencyChartsRow,
  SideRow,
  SummaryRow,
} from "./types";

const toSideRow = (side: SideSummary, currency: string): SideRow => ({
  total: formatMoney(side.total, currency),
  settled: formatMoney(side.settled, currency),
  pending: formatMoney(side.pending, currency),
});

// What share of the expenses' total is already paid, rounded, 0..100; 0 when there is nothing to pay.
// Rounding never reaches 100 while something is still unpaid (99.6 % paid is not "100 % pagado").
export const paidPercentOf = ({
  total,
  settled,
  pending,
}: SideSummary): number => {
  if (total <= 0) {
    return 0;
  }

  const rounded = Math.round((settled * 100) / total);
  // Never 100 while something is unpaid, never 0 once something is paid.
  const floor = settled > 0 ? 1 : 0;

  return pending > 0
    ? Math.min(99, Math.max(floor, rounded))
    : Math.min(100, Math.max(floor, rounded));
};

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
      pendingReimbursements,
    }) => ({
      currency,
      incomes: toSideRow(incomes, currency),
      expenses: toSideRow(expenses, currency),
      previous: formatMoney(previous, currency),
      current: formatMoney(current, currency),
      target: formatMoney(target, currency),
      reimbursements: formatMoney(pendingReimbursements, currency),
      paidPercent: paidPercentOf(expenses),
    }),
  );

// What the opening balance editor starts from: the accounts it offers, grouped by bank (by id: two
// banks can share a name) with the banks in the order their first account comes in (the Banks
// board's), each account with its saved amount as plain decimal text, or empty when none is saved.
// Every row is numbered across all the groups, in the order given: that number names its input.
export const toOpeningBalanceData = ({
  opening,
  accounts,
}: OpeningBalanceEditorData): OpeningBalanceData => {
  const saved = new Map(
    (opening?.amounts ?? []).map((amount) => [amount.accountId, amount]),
  );
  const groups = new Map<string, OpeningBankGroup>();

  accounts.forEach((account, index) => {
    const amount = saved.get(account.accountId);
    const row = {
      index,
      accountId: account.accountId,
      currency: account.currency,
      label: openingRowLabel(
        account.accountName,
        account.currency,
        account.archived,
      ),
      amount: amount ? toDecimalString(amount.amount, account.currency) : "",
    };
    const group = groups.get(account.bankId);

    if (group) {
      group.rows.push(row);
    } else {
      groups.set(account.bankId, {
        bankId: account.bankId,
        bankName: account.bankName,
        rows: [row],
      });
    }
  });

  return { month: opening?.month ?? null, groups: [...groups.values()] };
};

// The "Por cuenta" card's rows: money formatted on the server, in each account's own currency, so the
// client only places text.
export const toAccountRows = (
  groups: readonly CurrencyAccounts[],
): CurrencyAccountsRow[] =>
  groups.map(({ currency, total, banks }) => ({
    currency,
    totalLabel: formatMoney(total, currency),
    isTotalNegative: total < 0,
    banks: banks.map(({ bankId, bankName, accounts }) => ({
      bankId,
      bankName,
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        name: account.accountName,
        balanceLabel: formatMoney(account.balance, currency),
        isNegative: account.balance < 0,
        isArchived: account.archived,
      })),
    })),
  }));

// Where each group of the attention block is resolved. Expenses and incomes open their list on the
// planned ones, with no lower date (the overdue ones of earlier months show too) and the upper date of
// the rule; the kinds without a filter open their plain page.
export const attentionHref = (kind: AttentionKind, today: string): string => {
  switch (kind) {
    case "overdueExpense":
    case "upcomingExpense":
      return `${EXPENSES_PATH}${serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        status: "PLANNED",
        to: addDays(today, ATTENTION_DAYS_AHEAD),
      })}`;
    case "overdueIncome":
      return `${INCOMES_PATH}${serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        status: "PLANNED",
        to: addDays(today, -1),
      })}`;
    case "reimbursement":
      return INCOMES_PATH;
    case "negativeAccount":
      return BANKS_PATH;
    case "cardLimit":
      return CARDS_PATH;
    default: {
      // A new AttentionKind fails tsc here instead of silently linking to the cards page.
      const unreachable: never = kind;
      return unreachable;
    }
  }
};

// The attention block's rows: money formatted on the server, in each item's own currency.
export const toAttentionRows = (
  groups: readonly AttentionGroup[],
  today: string,
): AttentionGroupRow[] =>
  groups.map(({ kind, items, hiddenCount }) => ({
    kind,
    title: ATTENTION_COPY[kind].title,
    linkLabel: ATTENTION_COPY[kind].linkLabel,
    href: attentionHref(kind, today),
    hiddenCount,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      amountLabel: formatMoney(item.amount, item.currency),
      limitLabel:
        item.limit === null ? null : formatMoney(item.limit, item.currency),
      dateLabel: item.date === null ? null : formatIncomeDate(item.date),
      severity: item.severity,
    })),
  }));

const shareOf = (amount: number, total: number): string =>
  `${total <= 0 ? 0 : Math.round((amount * 100) / total)} %`;

// The charts' rows, one per currency that has any chart data, in the app's order. Every label is
// formatted here, in the row's own currency (crypto never goes through Intl as a currency).
export const toChartRows = ({
  monthly,
  categories,
  daily,
}: MonthCharts): CurrencyChartsRow[] => {
  const currencies = [
    ...new Set(
      [...monthly, ...categories, ...daily].map(({ currency }) => currency),
    ),
  ].sort(compareCurrencyCodes);

  return currencies.map((currency) => {
    const months =
      monthly.find((row) => row.currency === currency)?.months ?? [];
    const breakdown = categories.find((row) => row.currency === currency);
    const points = daily.find((row) => row.currency === currency)?.points ?? [];

    return {
      currency,
      monthly: months.map((row) => ({
        month: row.month,
        monthLabel: formatShortMonth(row.month),
        incomes: row.incomes,
        expenses: row.expenses,
        incomesLabel: formatMoney(row.incomes, currency),
        expensesLabel: formatMoney(row.expenses, currency),
      })),
      categories: (breakdown?.categories ?? []).map((row) => ({
        key: row.categoryId ?? OTHER_CATEGORY_KEY,
        name: row.name,
        amount: row.amount,
        amountLabel: formatMoney(row.amount, currency),
        shareLabel: shareOf(row.amount, breakdown?.total ?? 0),
        isOther: row.categoryId === null,
      })),
      daily: points.map((point) => ({
        date: point.date,
        dayLabel: formatShortDate(point.date),
        balance: point.balance,
        balanceLabel: formatMoney(point.balance, currency),
        isNegative: point.balance < 0,
      })),
    };
  });
};

// A block's promise that never rejects: a failure becomes `{ status: "error" }`, so the page shows a
// short error in that block and everything else stays on screen.
export const settleBlock = <T>(promise: Promise<T>): Promise<BlockResult<T>> =>
  promise.then(
    (value): BlockResult<T> => ({ status: "ok", value }),
    (): BlockResult<T> => ({ status: "error" }),
  );
