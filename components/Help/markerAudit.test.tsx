// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CardsTable } from "@/components/Cards/components/CardsTable";
import {
  TIER_LABELS,
  TIER_MEANINGS,
} from "@/components/Cards/components/CardsTable/components/UsageCell/components/TierChip/consts";
import { creditCardRow, limitRow } from "@/components/Cards/testRows";
import type { CardRow } from "@/components/Cards/types";
import { MARKERS } from "@/components/Entries/markers";
import { ExpensesTable } from "@/components/Expenses/components/ExpensesTable";
import type { ExpenseRow } from "@/components/Expenses/types";
import { IncomesTable } from "@/components/Incomes/components/IncomesTable";
import type { IncomeRow } from "@/components/Incomes/types";

import { LEGEND_GROUPS } from "./legend";
import type { LegendEntry } from "./types";

// An audit of every icon the tables draw: each one is in the legend the help page shows, drawn the
// same way, and tells what it means on hover and on focus. The rows below exercise every marker.

const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Netflix",
  amount: 3500000,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Ocio",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  isRecurring: true,
  installmentPlanId: "plan_1",
  installmentNumber: 1,
  cardId: null,
  purchaseDate: null,
  originCurrency: "USD",
  originAmount: 2000,
  originAmountDecimal: "20.00",
  originLabel: "Se cotizó en 20 USD",
  originTooltip: "Se cotizó en US$ 20,00 · cotización 1.750,00",
  expectedReimbursement: 1000000,
  reimbursementReceived: 600000,
  expectedReimbursementDecimal: "10000.00",
  reimbursementTooltip: "Te deben $ 4.000,00 de $ 10.000,00",
  amountLabel: "$ 35.000,00",
  amountDecimal: "35000.00",
  dateLabel: "5 sept 2026",
};

const COVERED_EXPENSE: ExpenseRow = {
  ...EXPENSE,
  id: "exp_2",
  description: "Cena",
  status: "COVERED",
  isRecurring: false,
  installmentPlanId: null,
  installmentNumber: null,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  expectedReimbursementDecimal: null,
  reimbursementTooltip: null,
};

const INCOME: IncomeRow = {
  id: "inc_1",
  description: "Sueldo",
  amount: 120000000,
  currency: "ARS",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Trabajo",
  notes: null,
  recurringIncomeId: "rec_1",
  installmentPlanId: "plan_2",
  installmentNumber: 1,
  status: "SETTLED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  amountLabel: "$ 1.200.000,00",
  amountDecimal: "1200000.00",
  dateLabel: "1 sept 2026",
  originCurrency: "USDC",
  originAmount: 100000,
  originAmountDecimal: "1000.00",
  originLabel: "Viene de 1.000 USDC",
  originTooltip: "Viene de 1.000,00 USDC · cotización 1.200,00",
  reimbursesExpenseId: "exp_9",
  reimbursesExpenseDescription: "Dentista",
  reimbursementTooltip: "Devolución de: Dentista",
};

const CARD: CardRow = creditCardRow();

const CARDS: CardRow[] = [
  CARD,
  creditCardRow({
    id: "card_2",
    title: "Visa •••• 2222",
    limits: [limitRow({ tier: "near", percent: 90 })],
  }),
  creditCardRow({
    id: "card_3",
    title: "Visa •••• 3333",
    limits: [limitRow({ tier: "exceeded", percent: 100 })],
  }),
];

const renderTables = () =>
  render(
    <>
      <ExpensesTable
        rows={[EXPENSE, COVERED_EXPENSE]}
        isFiltered={false}
        sort={{ key: "date", direction: "desc" }}
        onSortChange={() => {}}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />
      <IncomesTable
        rows={[INCOME]}
        isFiltered={false}
        sort={{ key: "date", direction: "desc" }}
        onSortChange={() => {}}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />
      <CardsTable
        rows={CARDS}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </>,
  );

const markers = (): HTMLElement[] => screen.getAllByRole("img");

// What a marker says: its accessible name.
const nameOf = (marker: HTMLElement): string =>
  marker.getAttribute("aria-label") ?? "";

// What a marker's tooltip says: the rows with an origin or a reimbursement spell out the exact amounts
// and names there.
const tooltipOf = (marker: HTMLElement): string => {
  const name = nameOf(marker);

  if (name === EXPENSE.originLabel) return EXPENSE.originTooltip ?? name;
  if (name === INCOME.originLabel) return INCOME.originTooltip ?? name;
  if (name === MARKERS.reimbursement.label) {
    return EXPENSE.reimbursementTooltip ?? name;
  }
  if (name === MARKERS.reimburses.label)
    return INCOME.reimbursementTooltip ?? name;

  return name;
};

const legendEntries = (): LegendEntry[] =>
  LEGEND_GROUPS.flatMap((group) => [...group.entries]);

const matches = (entry: LegendEntry, label: string): boolean => {
  if (!entry.marker) return false;

  return "label" in entry.marker
    ? entry.marker.label === label
    : label.startsWith(entry.marker.labelPrefix);
};

const entriesFor = (label: string): LegendEntry[] =>
  legendEntries().filter((entry) => matches(entry, label));

// React Aria opens a tooltip on focus only when the focus came from the keyboard, and a table first
// takes the focus itself (a keyboard user tabs into the table, then on to what is in its cells).
const focusWithKeyboard = (element: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: "Tab" });
  act(() => element.closest<HTMLElement>('[role="grid"]')?.focus());
  act(() => element.focus());
};

// The tooltip trigger that wraps the chip of a tier. The words of a tier can also be a column
// header ("Disponible"), so it is the one text that sits in a tooltip trigger.
const findTierChip = (label: string): HTMLElement | null => {
  for (const element of screen.queryAllByText(label)) {
    const chip = element.closest<HTMLElement>('[data-slot="tooltip-trigger"]');

    if (chip) return chip;
  }

  return null;
};

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(3000);
  });

describe("every icon the tables draw", () => {
  it("shows up in the tables of the audit: installment, recurring, repayment, origin (twice), reimbursement (both ways) and covered", () => {
    renderTables();

    expect(markers().map(nameOf)).toEqual([
      // Expenses: the first row, then the covered one.
      "Compra en cuotas",
      "Recurrente",
      "Se cotizó en 20 USD",
      "Reintegro esperado",
      "Cubierta por otro",
      // Incomes.
      "Recurrente",
      "Devolución en cuotas",
      "Viene de 1.000 USDC",
      "Devolución de un gasto",
    ]);
  });

  it("has exactly one entry in the legend, so the help page explains it", () => {
    renderTables();

    for (const marker of markers()) {
      expect(
        entriesFor(nameOf(marker)).map((entry) => entry.id),
        `legend entries for "${nameOf(marker)}"`,
      ).toHaveLength(1);
    }
  });

  it("is drawn in the legend with the very same icon", () => {
    renderTables();

    for (const marker of markers()) {
      const [entry] = entriesFor(nameOf(marker));
      const Icon = entry.icon;

      expect(Icon, `icon of "${entry.id}"`).toBeDefined();
      expect(marker.innerHTML).toBe(
        renderToStaticMarkup(Icon ? <Icon /> : null).replace(
          /^<svg[^>]*>|<\/svg>$/g,
          "",
        ),
      );
    }
  });

  it("is a tooltip trigger of its own that stays an image with an accessible name", () => {
    renderTables();

    for (const marker of markers()) {
      expect(marker.tagName.toLowerCase()).toBe("svg");
      expect(marker, nameOf(marker)).toHaveAttribute("tabindex", "0");
      expect(marker).toHaveAttribute("aria-label");
      expect(marker.querySelector("title")).toBeNull();
    }
  });

  it("tells what it means when the keyboard focuses it", () => {
    vi.useFakeTimers();

    try {
      renderTables();

      for (const marker of markers()) {
        focusWithKeyboard(marker);

        expect(screen.getByRole("tooltip"), nameOf(marker)).toHaveTextContent(
          tooltipOf(marker),
        );

        act(() => marker.blur());
        settle();

        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells what it means when the mouse enters it", () => {
    vi.useFakeTimers();

    try {
      renderTables();

      for (const marker of markers()) {
        // A real mouse moves before it enters: that is what tells React Aria it is the pointer.
        fireEvent.pointerMove(document.body, { pointerType: "mouse" });
        fireEvent.pointerEnter(marker, { pointerType: "mouse" });
        settle();

        expect(screen.getByRole("tooltip"), nameOf(marker)).toHaveTextContent(
          tooltipOf(marker),
        );

        fireEvent.pointerLeave(marker, { pointerType: "mouse" });
        settle();

        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells what the covered one means in the Status column of the expenses, on hover", () => {
    vi.useFakeTimers();

    try {
      renderTables();

      const status = within(
        screen.getByRole("grid", { name: "Gastos" }),
      ).getByRole("img", { name: "Cubierta por otro" });

      fireEvent.pointerMove(document.body, { pointerType: "mouse" });
      fireEvent.pointerEnter(status, { pointerType: "mouse" });
      settle();

      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Cubierta por otro",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the tiers of a card", () => {
  const tierChip = (tier: keyof typeof TIER_LABELS): HTMLElement => {
    const chip = findTierChip(TIER_LABELS[tier]);

    if (!chip) throw new Error(`The ${tier} tier has no tab stop`);

    return chip;
  };

  it("are all in the legend, and the legend has no others", () => {
    renderTables();

    const tierEntries = legendEntries().filter((entry) =>
      entry.id.startsWith("tier-"),
    );

    expect(tierEntries.map((entry) => entry.name).sort()).toEqual(
      Object.values(TIER_LABELS).sort(),
    );

    for (const label of Object.values(TIER_LABELS)) {
      expect(entriesFor(label)).toHaveLength(1);
      expect(findTierChip(label)).not.toBeNull();
    }
  });

  it.each(Object.keys(TIER_LABELS) as (keyof typeof TIER_LABELS)[])(
    "explain the %s tier on keyboard focus and on hover",
    (tier) => {
      vi.useFakeTimers();

      try {
        renderTables();

        focusWithKeyboard(tierChip(tier));
        expect(screen.getByRole("tooltip")).toHaveTextContent(
          TIER_MEANINGS[tier],
        );

        act(() => tierChip(tier).blur());
        settle();

        fireEvent.pointerMove(document.body, { pointerType: "mouse" });
        fireEvent.pointerEnter(tierChip(tier), { pointerType: "mouse" });
        settle();
        expect(screen.getByRole("tooltip")).toHaveTextContent(
          TIER_MEANINGS[tier],
        );
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

describe("the legend", () => {
  it("has an entry for every marker it names, and each one is drawn by a table", () => {
    renderTables();

    const names = markers().map(nameOf);

    for (const entry of legendEntries().filter(
      (candidate) => candidate.marker,
    )) {
      const isTier = entry.id.startsWith("tier-");
      const isDrawn = isTier
        ? findTierChip(entry.name) !== null
        : names.some((name) => matches(entry, name));

      expect(isDrawn, `"${entry.name}" is drawn by a table`).toBe(true);
    }
  });

  it("gives every entry a different id and name", () => {
    const entries = legendEntries();

    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(
      entries.length,
    );
  });
});
