import {
  BanknotesIcon,
  ReceiptPercentIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";

import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";
import { formatMoney } from "@/core/incomes/money";
import type { AttentionKind } from "@/core/summary/types";

import type { SummaryRow, SummaryRowSpec } from "./types";

export const PAGE_TITLE = "Resumen";
export const PAGE_DESCRIPTION = "Ingresos, gastos y remanentes del mes.";

// The header button that opens the opening balance editor.
export const OPENING_BALANCE_LABEL = "Saldo inicial";

// Where the summary lives, and the address parameter that says which month it shows
// (`/dashboard/overview?month=2026-03`). No parameter means the month in course.
export const SUMMARY_PATH = "/dashboard/overview";
export const MONTH_PARAM = "month";

// The rows of every currency's section, in order. Incomes and expenses use the same icons as the
// sidebar, so each one is recognised at a glance.
export const SUMMARY_ROWS: readonly SummaryRowSpec[] = [
  {
    id: "incomes",
    title: "Ingresos",
    tone: "income",
    Icon: BanknotesIcon,
    emphasis: false,
    cards: [
      { id: "total", label: "Total" },
      { id: "settled", label: "Cobrado" },
      { id: "pending", label: "Por cobrar" },
      {
        id: "reimbursements",
        label: "Reintegros pendientes",
        description:
          "Lo que esperás que te devuelvan y todavía no registraste como ingreso.",
      },
    ],
  },
  {
    id: "expenses",
    title: "Gastos",
    tone: "expense",
    Icon: ReceiptPercentIcon,
    emphasis: false,
    cards: [
      { id: "total", label: "Total" },
      { id: "settled", label: "Pagado" },
      { id: "pending", label: "Por pagar" },
    ],
  },
  {
    id: "remainders",
    title: "Remanentes",
    tone: "balance",
    Icon: ScaleIcon,
    emphasis: true,
    cards: [
      {
        id: "previous",
        label: "Saldo previo",
        emphasis: false,
        description: "Lo que sumaban tus cuentas al empezar el mes.",
      },
      {
        id: "current",
        label: "Actual",
        description:
          "Saldo previo más lo cobrado menos lo pagado en el mes, sumando todas tus cuentas.",
      },
      {
        id: "target",
        label: "Objetivo",
        description:
          "Cómo terminaría el mes pagando lo pendiente y, si lo sumás, cobrando lo que falta.",
      },
    ],
  },
];

// With nothing in the month the page keeps its shape: the cards at zero in the default currency,
// instead of an empty page.
const ZERO = formatMoney(0, DEFAULT_CURRENCY_CODE);

export const EMPTY_ROWS: readonly SummaryRow[] = [
  {
    currency: DEFAULT_CURRENCY_CODE,
    incomes: { total: ZERO, settled: ZERO, pending: ZERO },
    expenses: { total: ZERO, settled: ZERO, pending: ZERO },
    previous: ZERO,
    current: ZERO,
    target: ZERO,
    reimbursements: ZERO,
    paidPercent: 0,
  },
];

// The address parameter of the currency tab the month block shows (`?currency=USD`). ARS, the
// default, is never written.
export const CURRENCY_PARAM = "currency";

// The key of the "Otras" bar of the category chart (it folds several categories, so it has no id).
export const OTHER_CATEGORY_KEY = "other";

// What each group of the attention block is called and what its link says.
export const ATTENTION_COPY: Readonly<
  Record<AttentionKind, { title: string; linkLabel: string }>
> = {
  overdueExpense: { title: "Gastos vencidos", linkLabel: "Ver gastos" },
  negativeAccount: { title: "Cuentas en negativo", linkLabel: "Ver Bancos" },
  cardLimit: { title: "Tarjetas cerca del tope", linkLabel: "Ver Tarjetas" },
  upcomingExpense: {
    title: "Gastos de los próximos 7 días",
    linkLabel: "Ver gastos",
  },
  overdueIncome: { title: "Ingresos atrasados", linkLabel: "Ver ingresos" },
  reimbursement: { title: "Reintegros pendientes", linkLabel: "Ver ingresos" },
};

// The address parameter of the section tab the page shows (`?section=month`). The first section
// (accounts), the default, is never written.
export const SECTION_PARAM = "section";
