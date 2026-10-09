import { describe, expect, it } from "vitest";

import { creditCard } from "@/core/cards/testFixtures";
import type {
  CardLimitUsage,
  CardTier,
  CardWithUsage,
} from "@/core/cards/types";

import { buildAttention } from "./attention";
import type { AccountBalanceRow } from "./byAccount";
import { ATTENTION_KIND_ORDER } from "./consts";
import type { AttentionSources, PlannedEntry } from "./types";

const TODAY = "2026-10-08";

const NOTHING: AttentionSources = {
  today: TODAY,
  plannedExpenses: [],
  plannedIncomes: [],
  reimbursements: [],
  accounts: [],
  cards: [],
};

const entry = (id: string, date: string, amount = 1000): PlannedEntry => ({
  id,
  description: `Entrada ${id}`,
  currency: "ARS",
  amount,
  date,
});

const reimbursement = (id: string, date: string) => ({
  id,
  description: `Reintegro ${id}`,
  date,
  currency: "ARS",
  outstanding: 5000,
});

const account = (
  accountId: string,
  balance: number,
  currency = "ARS",
): AccountBalanceRow => ({
  accountId,
  accountName: "Caja",
  bankId: "b1",
  bankName: "Galicia",
  currency,
  balance,
  archived: false,
});

const usage = (
  tier: CardTier,
  used: number,
  currency = "ARS",
  amount = 100000,
): CardLimitUsage => ({
  currency,
  amount,
  committedTotal: used,
  monthUsed: used,
  used,
  available: amount - used,
  tier,
});

const card = (id: string, limits: CardLimitUsage[]): CardWithUsage => ({
  ...creditCard({ id }),
  usage: limits,
});

const ids = (sources: AttentionSources) =>
  buildAttention(sources).flatMap(({ items }) => items.map(({ id }) => id));

describe("buildAttention", () => {
  it("is empty when nothing needs attention: it never invents an item", () => {
    expect(buildAttention(NOTHING)).toEqual([]);
  });

  it("lists an expense dated before today as overdue, from today to seven days ahead as upcoming, and not one eight days ahead", () => {
    const groups = buildAttention({
      ...NOTHING,
      plannedExpenses: [
        entry("e_yesterday", "2026-10-07"),
        entry("e_today", "2026-10-08"),
        entry("e_week", "2026-10-15"),
        entry("e_later", "2026-10-16"),
      ],
    });

    expect(groups.map(({ kind }) => kind)).toEqual([
      "overdueExpense",
      "upcomingExpense",
    ]);
    expect(groups[0].items.map(({ id }) => id)).toEqual(["e_yesterday"]);
    expect(groups[1].items.map(({ id }) => id)).toEqual(["e_today", "e_week"]);
    expect(
      groups.flatMap(({ items }) => items.map(({ id }) => id)),
    ).not.toContain("e_later");
  });

  it("lists a planned income only once its day has passed", () => {
    const listed = ids({
      ...NOTHING,
      plannedIncomes: [
        entry("i_yesterday", "2026-10-07"),
        entry("i_today", "2026-10-08"),
      ],
    });

    expect(listed).toEqual(["i_yesterday"]);
    expect(listed).not.toContain("i_today");
  });

  it("lists the oldest first inside a group", () => {
    const [overdue] = buildAttention({
      ...NOTHING,
      plannedExpenses: [
        entry("e_october", "2026-10-01"),
        entry("e_september", "2026-09-15"),
      ],
    });

    expect(overdue.items.map(({ id }) => id)).toEqual([
      "e_september",
      "e_october",
    ]);
  });

  it("lists the oldest overdue income first, given the newest first", () => {
    const groups = buildAttention({
      ...NOTHING,
      plannedIncomes: [
        entry("i_october", "2026-10-01"),
        entry("i_september", "2026-09-15"),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("overdueIncome");
    expect(groups[0].items.map(({ id }) => id)).toEqual([
      "i_september",
      "i_october",
    ]);
  });

  it("lists the oldest reimbursement first, given the newest first, and breaks a same-date tie by id", () => {
    const [ordered] = buildAttention({
      ...NOTHING,
      reimbursements: [
        reimbursement("r_october", "2026-10-01"),
        reimbursement("r_september", "2026-09-01"),
      ],
    });
    const [tied] = buildAttention({
      ...NOTHING,
      reimbursements: [
        reimbursement("r_b", "2026-09-01"),
        reimbursement("r_a", "2026-09-01"),
      ],
    });

    expect(ordered.items.map(({ id }) => id)).toEqual([
      "r_september",
      "r_october",
    ]);
    expect(tied.items).toHaveLength(2);
    expect(tied.items.map(({ id }) => id)).toEqual(["r_a", "r_b"]);
  });

  it("puts the groups in order, the most urgent kind first", () => {
    const groups = buildAttention({
      today: TODAY,
      plannedExpenses: [
        entry("e_old", "2026-10-01"),
        entry("e_soon", "2026-10-10"),
      ],
      plannedIncomes: [entry("i_old", "2026-10-01")],
      reimbursements: [
        {
          id: "r1",
          description: "Médico",
          date: "2026-09-01",
          currency: "ARS",
          outstanding: 5000,
        },
      ],
      accounts: [account("a1", -100)],
      cards: [card("card_1", [usage("near", 85000)])],
    });

    expect(groups.map(({ kind }) => kind)).toEqual([...ATTENTION_KIND_ORDER]);
  });

  it("shows at most five lines per group and counts the rest", () => {
    const seven = ["01", "02", "03", "04", "05", "06", "07"].map((dayOfMonth) =>
      entry(`e_${dayOfMonth}`, `2026-10-${dayOfMonth}`),
    );
    const [overdue] = buildAttention({ ...NOTHING, plannedExpenses: seven });
    const [few] = buildAttention({
      ...NOTHING,
      plannedExpenses: seven.slice(0, 5),
    });

    expect(overdue.items).toHaveLength(5);
    expect(overdue.hiddenCount).toBe(2);
    expect(few.items).toHaveLength(5);
    expect(few.hiddenCount).toBe(0);
  });

  it("lists an account below zero with its bank, name and balance, and not one at zero or above", () => {
    const groups = buildAttention({
      ...NOTHING,
      accounts: [
        account("a_neg", -1),
        account("a_zero", 0),
        account("a_pos", 100),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toEqual([
      {
        kind: "negativeAccount",
        id: "a_neg",
        title: "Galicia · Caja",
        currency: "ARS",
        amount: -1,
        limit: null,
        date: null,
        severity: "danger",
      },
    ]);
  });

  it("orders the accounts below zero by currency, then the lowest balance first", () => {
    const [group] = buildAttention({
      ...NOTHING,
      accounts: [
        account("a1", -50, "USD"),
        account("a2", -10),
        account("a3", -900),
      ],
    });

    expect(group.items).toHaveLength(3);
    expect(group.items.map(({ id }) => id)).toEqual(["a3", "a2", "a1"]);
  });

  it("lists every cap that is near or over, the one over first, and never an available one", () => {
    const groups = buildAttention({
      ...NOTHING,
      cards: [
        card("card_1", [
          usage("near", 85000),
          usage("available", 10, "USD", 100),
        ]),
        card("card_2", [usage("exceeded", 120000)]),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map(({ id }) => id)).toEqual([
      "card_2:ARS",
      "card_1:ARS",
    ]);
    expect(groups[0].items.map(({ severity }) => severity)).toEqual([
      "danger",
      "warning",
    ]);
    expect(groups[0].items[1]).toMatchObject({
      title: "Visa •••• 1234 · Banco Galicia",
      currency: "ARS",
      amount: 85000,
      limit: 100000,
      date: null,
    });
  });

  it("puts the fuller cap first among caps of the same tier, whatever order the cards arrive in", () => {
    const [group] = buildAttention({
      ...NOTHING,
      cards: [
        card("card_a", [usage("near", 85000)]),
        card("card_b", [usage("near", 95000)]),
      ],
    });

    expect(group.items).toHaveLength(2);
    expect(group.items.map(({ id }) => id)).toEqual([
      "card_b:ARS",
      "card_a:ARS",
    ]);
  });

  it("lists every pending reimbursement with what is still outstanding", () => {
    const [group] = buildAttention({
      ...NOTHING,
      reimbursements: [
        {
          id: "r1",
          description: "Médico",
          date: "2026-09-01",
          currency: "USD",
          outstanding: 5000,
        },
      ],
    });

    expect(group.items).toEqual([
      {
        kind: "reimbursement",
        id: "r1",
        title: "Médico",
        currency: "USD",
        amount: 5000,
        limit: null,
        date: "2026-09-01",
        severity: "warning",
      },
    ]);
  });

  it("marks overdue entries as danger and upcoming ones as warning", () => {
    const groups = buildAttention({
      ...NOTHING,
      plannedExpenses: [
        entry("e_old", "2026-10-01"),
        entry("e_soon", "2026-10-10"),
      ],
      plannedIncomes: [entry("i_old", "2026-10-01")],
    });

    expect(groups.map(({ kind, items }) => [kind, items[0].severity])).toEqual([
      ["overdueExpense", "danger"],
      ["upcomingExpense", "warning"],
      ["overdueIncome", "danger"],
    ]);
  });
});
