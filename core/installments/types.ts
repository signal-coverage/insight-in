import type { EntryStatus } from "@/core/entries/status";

import type { AMOUNT_MODES, CARD_OWNERSHIPS } from "./consts";

// How the single amount of the planner is read: the whole purchase, or one installment.
export type AmountMode = (typeof AMOUNT_MODES)[number];

// Whose card pays the purchase: one of the user's own, or one borrowed from somebody else.
export type CardOwnership = (typeof CARD_OWNERSHIPS)[number];

// A validated purchase in installments. `totalAmount` is in minor units, `firstDate` a calendar
// date "YYYY-MM-DD".
export interface InstallmentPlanInput {
  description: string;
  categoryId: string;
  currency: string;
  // The account that pays the installments (with a card, the account that pays its statement). It
  // is the user's, active and in the currency of the purchase (the service checks it).
  accountId: string;
  notes: string | null;
  totalCuotas: number;
  totalAmount: number;
  firstDate: string;
  // The user's own card the purchase was paid with and the day it was made. Only a purchase paid with
  // an own card has them (a borrowed card has no record); the service checks the card is the user's
  // and in the currency of the purchase, and then works the dates out from its billing cycle instead
  // of using `firstDate`.
  cardId?: string | null;
  purchaseDate?: string | null;
}

// What the planner sends: plain values, the amount still as typed. The server works out the total
// in minor units, with the currency's decimals.
export interface InstallmentPlanPayload {
  description: string;
  categoryId: string;
  currency: string;
  accountId: string;
  notes: string;
  amount: string;
  amountMode: AmountMode;
  totalCuotas: number;
  // With no card, the date the user typed for the first installment. With one, the date the planner
  // worked out from the card's cycle: the server works it out again and never trusts this one.
  firstDate: string;
  // Whose card pays the purchase. "own" needs `cardId` (and `purchaseDate`); "borrowed" must not carry
  // a card, since there is no record of it.
  cardOwnership: CardOwnership;
  // The own card the purchase is paid with and the day it was made. Both are sent together or not at all.
  cardId?: string | null;
  purchaseDate?: string | null;
}

// A validated loan repaid to the user in installments: like a purchase, without a card. The category
// is one of the user's income categories.
export interface IncomeInstallmentPlanInput {
  description: string;
  categoryId: string;
  currency: string;
  // The account the money arrives in. It is the user's, active and in the currency of the loan.
  accountId: string;
  notes: string | null;
  totalCuotas: number;
  totalAmount: number;
  firstDate: string;
}

// What the repayment planner sends: plain values, the amount still as typed. The `kind` tells the
// server which sort of plan it is; the date is the one the user typed for the first installment.
export interface IncomeInstallmentPlanPayload {
  kind: "income";
  description: string;
  categoryId: string;
  currency: string;
  accountId: string;
  notes: string;
  amount: string;
  amountMode: AmountMode;
  totalCuotas: number;
  firstDate: string;
}

// One installment as it will be created.
export interface PlannedInstallment {
  number: number;
  description: string;
  // Minor units.
  amount: number;
  date: string;
}

// An installment as the wizard knows it.
export interface InstallmentRow {
  // The expense's id.
  id: string;
  number: number;
  date: string;
  status: EntryStatus;
}

// A plan and its installments, which is all the reflow needs.
export interface PlanForReflow {
  id: string;
  description: string;
  dayOfMonth: number;
  installments: readonly InstallmentRow[];
}

// An installment with its amount (minor units), as read from the database.
export interface InstallmentDetail extends InstallmentRow {
  amount: number;
}

// A plan as read from the database, with everything the wizard shows about it.
export interface PlanDetail extends PlanForReflow {
  categoryName: string;
  currency: string;
  totalCuotas: number;
  // The card the purchase was paid with and the day it was made; null for a purchase with neither.
  cardId: string | null;
  purchaseDate: string | null;
  installments: readonly InstallmentDetail[];
}

// What the wizard sends for a plan the user changed: how many of its pending installments fall
// in the month being resolved.
export interface InstallmentCountInput {
  planId: string;
  count: number;
}

// An installment that has to change its date.
export interface DateMove {
  id: string;
  date: string;
}

// How many entries a plan has right now and how many of them are already paid or collected (anything
// but still planned). What the delete dialog says before the whole plan goes away.
export interface PlanProgress {
  total: number;
  settled: number;
}

// A plan with pending installments, as the wizard lists it.
export interface InstallmentPlanItem {
  id: string;
  description: string;
  categoryName: string;
  currency: string;
  totalCuotas: number;
  // Installments already paid or covered.
  doneCount: number;
  // Installments still to pay: the most the user can ask for in one month.
  pendingCount: number;
  // The amount (minor units) of the next installment to pay.
  nextAmount: number;
  // The pending installments already dated in the month being resolved.
  defaultCount: number;
}
