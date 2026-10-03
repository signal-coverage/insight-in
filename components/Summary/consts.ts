import {
  BanknotesIcon,
  ReceiptPercentIcon,
  ScaleIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";

import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";
import { formatMoney } from "@/core/incomes/money";

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
        id: "current",
        label: "Actual",
        description: "Saldo previo más lo cobrado menos lo pagado, en cuentas.",
      },
      {
        id: "target",
        label: "Objetivo",
        description:
          "Cómo terminaría el mes pagando lo pendiente y, si lo sumás, cobrando lo que falta.",
      },
    ],
  },
  {
    id: "balances",
    title: "Saldos",
    tone: "balance",
    Icon: WalletIcon,
    emphasis: false,
    cards: [
      {
        id: "previous",
        label: "Saldo previo",
        description: "Lo que quedó de los meses anteriores, en cuentas.",
      },
      {
        id: "wallet",
        label: "Billetera",
        description: "El efectivo que tenés en mano.",
      },
      {
        id: "available",
        label: "Total disponible",
        emphasis: true,
        description: "Remanente actual más billetera: lo que tenés hoy.",
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
    wallet: ZERO,
    available: ZERO,
    reimbursements: ZERO,
  },
];
