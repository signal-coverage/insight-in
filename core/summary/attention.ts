import { BRAND_NAMES } from "@/core/cards/consts";
import { compareCurrencyCodes } from "@/core/currencies/crypto";

import {
  ATTENTION_DAYS_AHEAD,
  ATTENTION_ITEMS_PER_GROUP,
  ATTENTION_KIND_ORDER,
} from "./consts";
import { addDays } from "./days";
import type {
  AttentionGroup,
  AttentionItem,
  AttentionKind,
  AttentionSources,
  PlannedEntry,
} from "./types";

// What needs the user's attention today. Pure: it works on rows already read, and it never invents
// an item: a group with nothing in it is left out, and so is the whole block when nothing applies.
// Every amount stays in its own currency.

const byDate = (
  a: { date: string; id: string },
  b: { date: string; id: string },
): number => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

const fromEntry =
  (kind: AttentionKind, severity: AttentionItem["severity"]) =>
  ({
    id,
    description,
    currency,
    amount,
    date,
  }: PlannedEntry): AttentionItem => ({
    kind,
    id,
    title: description,
    currency,
    amount,
    limit: null,
    date,
    severity,
  });

export const buildAttention = ({
  today,
  plannedExpenses,
  plannedIncomes,
  reimbursements,
  accounts,
  cards,
}: AttentionSources): AttentionGroup[] => {
  const horizon = addDays(today, ATTENTION_DAYS_AHEAD);
  const expenses = [...plannedExpenses].sort(byDate);

  const items: Record<AttentionKind, AttentionItem[]> = {
    overdueExpense: expenses
      .filter(({ date }) => date < today)
      .map(fromEntry("overdueExpense", "danger")),
    upcomingExpense: expenses
      .filter(({ date }) => date >= today && date <= horizon)
      .map(fromEntry("upcomingExpense", "warning")),
    overdueIncome: plannedIncomes
      .filter(({ date }) => date < today)
      .sort(byDate)
      .map(fromEntry("overdueIncome", "danger")),
    reimbursement: [...reimbursements]
      .sort(byDate)
      .map(
        ({ id, description, currency, outstanding, date }): AttentionItem => ({
          kind: "reimbursement",
          id,
          title: description,
          currency,
          amount: outstanding,
          limit: null,
          date,
          severity: "warning",
        }),
      ),
    negativeAccount: accounts
      .filter(({ balance }) => balance < 0)
      .sort(
        (a, b) =>
          compareCurrencyCodes(a.currency, b.currency) ||
          a.balance - b.balance ||
          a.accountId.localeCompare(b.accountId),
      )
      .map(
        ({
          accountId,
          bankName,
          accountName,
          currency,
          balance,
        }): AttentionItem => ({
          kind: "negativeAccount",
          id: accountId,
          title: `${bankName} · ${accountName}`,
          currency,
          amount: balance,
          limit: null,
          date: null,
          severity: "danger",
        }),
      ),
    cardLimit: cards
      .flatMap((card) =>
        card.usage
          .filter(({ tier }) => tier !== "available")
          .map((cap) => ({ card, cap })),
      )
      .sort(
        (a, b) =>
          Number(b.cap.tier === "exceeded") -
            Number(a.cap.tier === "exceeded") ||
          b.cap.used / b.cap.amount - a.cap.used / a.cap.amount ||
          a.card.id.localeCompare(b.card.id),
      )
      .map(({ card, cap }): AttentionItem => ({
        kind: "cardLimit",
        id: `${card.id}:${cap.currency}`,
        title: `${BRAND_NAMES[card.brand]} •••• ${card.last4} · ${card.bankName}`,
        currency: cap.currency,
        amount: cap.used,
        limit: cap.amount,
        date: null,
        severity: cap.tier === "exceeded" ? "danger" : "warning",
      })),
  };

  return ATTENTION_KIND_ORDER.flatMap((kind) => {
    const all = items[kind];

    return all.length === 0
      ? []
      : [
          {
            kind,
            items: all.slice(0, ATTENTION_ITEMS_PER_GROUP),
            hiddenCount: Math.max(0, all.length - ATTENTION_ITEMS_PER_GROUP),
          },
        ];
  });
};
