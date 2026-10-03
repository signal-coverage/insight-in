import type { ComponentType, SVGProps } from "react";

import type { InstallmentPlanItem } from "@/core/installments/types";

// Types shared by the incomes and expenses screens.

// One card of the totals bar: amounts are already formatted in the category's currency, so the
// client never re-derives money presentation. `settled` and `pending` split `label`.
export interface TotalRow {
  currency: string;
  label: string;
  settled: string;
  pending: string;
}

export interface PaginationInfo {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export interface EntryCategory {
  id: string;
  name: string;
}

// A category plus how many entries (incomes or expenses) use it.
export interface CategoryWithCount extends EntryCategory {
  count: number;
}

// A plan paid (a purchase) or collected (a loan repaid) in installments plus the strings the monthly
// list shows, formatted on the server.
export interface InstallmentPlanRow extends InstallmentPlanItem {
  // The next installment to pay or collect, in its currency.
  nextAmountLabel: string;
  // "3 de 12 · quedan 9".
  progressLabel: string;
}

// How many installments of each plan the user wants this month, per plan id; a plan without an entry
// keeps the number that already falls in the month.
export type InstallmentCounts = Record<string, number>;

// One line of the ticket that summarises a purchase or a repayment in installments.
export interface TicketLine {
  label: string;
  value: string;
  // A remark under the value.
  note?: string;
}

// The strings of the origin of an entry (what an income came from, or the price an expense was quoted
// in), formatted on the server: its amount as a plain decimal for the form, the short text of the
// table marker and the longer one of its tooltip. All null when the entry has no origin.
export interface OriginStrings {
  originAmountDecimal: string | null;
  originLabel: string | null;
  originTooltip: string | null;
}

// An entry as far as its origin is concerned: the amount that really moved and the reference.
export interface OriginSource {
  amount: number;
  currency: string;
  originCurrency: string | null;
  originAmount: number | null;
}

// What the implied rate is worked out from: both amounts as typed (plain decimals) and their currencies.
export interface OriginRateInput {
  netAmount: string;
  netCurrency: string;
  originAmount: string;
  originCurrency: string | null;
}

export type FieldErrors = Record<string, string[]>;

export type ActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export type CategoryActionResult =
  | { status: "success"; category: EntryCategory }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

// What the shared category pieces call, so they work for incomes and expenses alike.
export interface CategoryActions {
  create: (name: string) => Promise<CategoryActionResult>;
  rename: (id: string, name: string) => Promise<CategoryActionResult>;
  remove: (id: string) => Promise<ActionResult>;
}

// What the delete dialog of an installment removes: only that cuota, or the whole plan with every one
// of its cuotas.
export type DeleteScope = "entry" | "plan";

// Which side of the money a plan is on: a purchase paid in cuotas, or a loan repaid to the user.
export type PlanSide = "expense" | "income";

// An icon that carries a meaning next to a value, and what it says.
export interface MarkerDefinition {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}
