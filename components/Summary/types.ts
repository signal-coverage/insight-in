import type { ComponentType, SVGProps } from "react";

import type { Source } from "@/components/shared/Await";
import type { AttentionKind, AttentionSeverity } from "@/core/summary/types";

import type { OpeningBalanceData } from "./components/OpeningBalanceDrawer";

// One side of the budget (incomes or expenses), every amount already formatted for its currency so
// the client never re-derives money presentation.
export interface SideRow {
  total: string;
  settled: string;
  pending: string;
}

export interface SummaryRow {
  currency: string;
  incomes: SideRow;
  expenses: SideRow;
  // What the accounts held when the month began.
  previous: string;
  // What the accounts hold after the month's movements.
  current: string;
  // Where the month would end if nothing else changed.
  target: string;
  // What is still expected back from expenses and not yet registered as income. Only informational.
  reimbursements: string;
  // What share of the expenses' total is already paid, 0..100 (the bar under Gastos).
  paidPercent: number;
}

// One account of the "Por cuenta" card, its balance already formatted in its currency.
export interface AccountLine {
  accountId: string;
  name: string;
  balanceLabel: string;
  // Negative balances are shown in red, never blocked.
  isNegative: boolean;
  isArchived: boolean;
}

export interface BankLines {
  bankId: string;
  bankName: string;
  accounts: AccountLine[];
}

// One currency's card: its total and its banks.
export interface CurrencyAccountsRow {
  currency: string;
  totalLabel: string;
  isTotalNegative: boolean;
  banks: BankLines[];
}

export interface SummaryProps {
  // The month the numbers belong to, "YYYY-MM", and the month in course, which is where the
  // selector's "Mes actual" goes.
  month: string;
  currentMonth: string;
  // The month the numbers belong to, written out ("Septiembre de 2026").
  monthLabel: string;
  // One row per currency, or a promise of them while they load.
  summary: Source<readonly SummaryRow[]>;
  // What the opening balance editor starts from, or a promise of it while it loads.
  openingBalance: Source<OpeningBalanceData>;
  // Whether the target remainder counts the incomes still to collect (the saved setting), or a
  // promise of it while it loads.
  includeExpectedIncomes: Source<boolean>;
  // The currencies the user hides from the month block's tabs (display only), or a promise of them
  // while they load.
  hiddenCurrencies: Source<readonly string[]>;
  // What each account holds today, per currency and bank, or a promise of it while it loads.
  accountBalances: Source<readonly CurrencyAccountsRow[]>;
  // What needs attention today, or an error result when it could not be read.
  attention: Source<BlockResult<readonly AttentionGroupRow[]>>;
  // The charts of every currency of the month, or an error result when they could not be read.
  charts: Source<BlockResult<readonly CurrencyChartsRow[]>>;
}

// What a row of cards is about: money coming in, money going out, or what is left.
export type RowTone = "income" | "expense" | "balance";

export interface SummaryCardSpec {
  // Which amount of the summary row the card shows.
  id:
    | "total"
    | "settled"
    | "pending"
    | "current"
    | "target"
    | "previous"
    | "reimbursements";
  label: string;
  // Makes this one card stand out even when its row does not.
  emphasis?: boolean;
  // A line that says what the amount means, for the ones that are not obvious.
  description?: string;
}

// A row of a currency's section, described once so the real section and its loading placeholder
// are always made of the same rows.
export interface SummaryRowSpec {
  id: "incomes" | "expenses" | "remainders";
  title: string;
  tone: RowTone;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  // The remainders are the result of the other rows, so their cards stand out.
  emphasis: boolean;
  cards: readonly SummaryCardSpec[];
}

// A block of the page that loads on its own: when its read fails the page shows a short error in its
// place instead of going down.
export type BlockResult<T> = { status: "ok"; value: T } | { status: "error" };

// One month of the income-against-expenses chart: the amounts for the geometry, the labels for the text.
export interface MonthlyChartRow {
  month: string;
  monthLabel: string;
  incomes: number;
  expenses: number;
  incomesLabel: string;
  expensesLabel: string;
}

// One bar of the category chart.
export interface CategoryChartRow {
  key: string;
  name: string;
  amount: number;
  amountLabel: string;
  // "45 %": its share of the month's expenses.
  shareLabel: string;
  // The bar that folds the smallest categories ("Otras").
  isOther: boolean;
}

// One day of the balance chart.
export interface DailyChartPoint {
  date: string;
  // "08/10".
  dayLabel: string;
  balance: number;
  balanceLabel: string;
  isNegative: boolean;
}

// The three charts of one currency.
export interface CurrencyChartsRow {
  currency: string;
  monthly: MonthlyChartRow[];
  categories: CategoryChartRow[];
  daily: DailyChartPoint[];
}

// A line of the attention block, every amount already formatted in its own currency.
export interface AttentionItemRow {
  id: string;
  title: string;
  amountLabel: string;
  // The cap of a card ("usado X de Y"); null for everything else.
  limitLabel: string | null;
  // When it is due or was dated; null for accounts and cards.
  dateLabel: string | null;
  severity: AttentionSeverity;
}

// A group of the attention block: what it is, where it is resolved and its lines.
export interface AttentionGroupRow {
  kind: AttentionKind;
  title: string;
  linkLabel: string;
  href: string;
  items: AttentionItemRow[];
  hiddenCount: number;
}

// What a currency's panels draw: the month in detail (only the figures) or the last six months (the
// three charts).
export type SummaryView = "month" | "history";
