import { describe, expect, it } from "vitest";

import type {
  Conversions,
  PairEvolution,
  PairSummary,
} from "@/core/conversions/types";

import { pairCards, toConversionsView } from "./utils";

const INCOME_PAIR: PairSummary = {
  side: "income",
  originCurrency: "USDC",
  netCurrency: "ARS",
  count: 2,
  totalOrigin: 1_500_000_000,
  totalNet: 186_000_000,
  averageRate: 1240,
  best: { rate: 1320, date: "2026-09-20" },
  worst: { rate: 1200, date: "2026-09-05" },
  last: { rate: 1320, date: "2026-09-20" },
  items: [
    {
      id: "b",
      date: "2026-09-20",
      description: "Extra",
      originAmount: 500_000_000,
      netAmount: 66_000_000,
      rate: 1320,
    },
    {
      id: "a",
      date: "2026-09-05",
      description: "Sueldo",
      originAmount: 1_000_000_000,
      netAmount: 120_000_000,
      rate: 1200,
    },
  ],
};

const EXPENSE_PAIR: PairSummary = {
  side: "expense",
  originCurrency: "USD",
  netCurrency: "ARS",
  count: 1,
  totalOrigin: 2000,
  totalNet: 3_500_000,
  averageRate: 1750,
  best: { rate: 1750, date: "2026-09-05" },
  worst: { rate: 1750, date: "2026-09-05" },
  last: { rate: 1750, date: "2026-09-05" },
  items: [
    {
      id: "e",
      date: "2026-09-05",
      description: "Suscripción",
      originAmount: 2000,
      netAmount: 3_500_000,
      rate: 1750,
    },
  ],
};

const EVOLUTION: PairEvolution = {
  side: "income",
  originCurrency: "USDC",
  netCurrency: "ARS",
  points: [
    { month: "2026-08", rate: 1100, variation: null },
    { month: "2026-09", rate: 1240, variation: 12.7272 },
  ],
};

const conversions = (overrides: Partial<Conversions> = {}): Conversions => ({
  incomes: [INCOME_PAIR],
  expenses: [EXPENSE_PAIR],
  evolution: [EVOLUTION],
  ...overrides,
});

describe("toConversionsView", () => {
  it("names a pair origin first for an income and net first for an expense, as the data has it", () => {
    const view = toConversionsView(conversions());

    expect(view.incomes[0].id).toBe("USDC → ARS");
    expect(view.expenses[0].id).toBe("ARS → USD");
  });

  it("formats each amount in its own currency: the origin in the origin's, the net in the net's", () => {
    const [pair] = toConversionsView(conversions()).incomes;

    expect(pair.count).toBe("2");
    expect(pair.totalOrigin).toBe("1.500,00 USDC");
    expect(pair.totalNet).toMatch(/1\.860\.000,00/);
    expect(pair.totalNet).not.toMatch(/USDC/);
  });

  it("formats an expense's origin as the money it is (US$) and its net in pesos", () => {
    const [pair] = toConversionsView(conversions()).expenses;

    expect(pair.totalOrigin).toMatch(/US\$\s?20,00/);
    expect(pair.totalNet).toMatch(/35\.000,00/);
  });

  it("formats the rates as an amount of the net currency, with the date they happened", () => {
    const [pair] = toConversionsView(conversions()).incomes;

    expect(pair.averageRate).toMatch(/\$\s?1\.240,00/);
    expect(pair.best.rate).toMatch(/1\.320,00/);
    expect(pair.best.date).toMatch(/20/);
    expect(pair.worst.rate).toMatch(/1\.200,00/);
    expect(pair.last.rate).toMatch(/1\.320,00/);
  });

  it("formats every conversion of the table", () => {
    const [pair] = toConversionsView(conversions()).incomes;

    expect(pair.items).toHaveLength(2);
    expect(pair.items[0]).toMatchObject({
      id: "b",
      description: "Extra",
      origin: "500,00 USDC",
    });
    expect(pair.items[0].net).toMatch(/660\.000,00/);
    expect(pair.items[0].rate).toMatch(/1\.320,00/);
  });

  it("keeps the sides apart", () => {
    const view = toConversionsView(conversions({ expenses: [] }));

    expect(view.incomes).toHaveLength(1);
    expect(view.expenses).toEqual([]);
  });

  it("writes the evolution month by month, with the variation signed and an empty one as a dash", () => {
    const [evolution] = toConversionsView(conversions()).evolution;

    expect(evolution.pair).toBe("USDC → ARS");
    expect(evolution.side).toBe("income");
    expect(evolution.rows.map(({ month }) => month)).toEqual([
      "Agosto de 2026",
      "Septiembre de 2026",
    ]);
    expect(evolution.rows[0].variation).toBe("—");
    expect(evolution.rows[1].variation).toBe("+12,7 %");
    expect(evolution.rows[1].rate).toMatch(/1\.240,00/);
  });

  it("shows a fall with its minus sign", () => {
    const view = toConversionsView(
      conversions({
        evolution: [
          {
            ...EVOLUTION,
            points: [
              { month: "2026-08", rate: 1100, variation: null },
              { month: "2026-09", rate: 1045, variation: -5 },
            ],
          },
        ],
      }),
    );

    expect(view.evolution[0].rows[1].variation).toBe("-5,0 %");
  });

  it("gives the evolution of the same pair on both sides a distinct id", () => {
    const view = toConversionsView(
      conversions({
        evolution: [EVOLUTION, { ...EVOLUTION, side: "expense" }],
      }),
    );

    expect(new Set(view.evolution.map(({ id }) => id)).size).toBe(2);
  });
});

describe("pairCards", () => {
  it("lists the seven cards in order, labelled for an income", () => {
    const [pair] = toConversionsView(conversions()).incomes;

    expect(pairCards(pair).map(({ label }) => label)).toEqual([
      "Conversiones",
      "Origen enviado",
      "Neto recibido",
      "Cotización promedio",
      "Mejor cotización",
      "Peor cotización",
      "Última cotización",
    ]);
  });

  it("labels them for an expense", () => {
    const [pair] = toConversionsView(conversions()).expenses;

    expect(pairCards(pair).map(({ label }) => label)).toEqual([
      "Compras",
      "Precio de origen",
      "Pagado",
      "Cotización promedio",
      "Mejor cotización",
      "Peor cotización",
      "Última cotización",
    ]);
  });

  it("carries the figures, and the date under the single rates", () => {
    const [pair] = toConversionsView(conversions()).incomes;
    const cards = pairCards(pair);

    expect(cards[0].value).toBe("2");
    expect(cards[1].value).toBe("1.500,00 USDC");
    expect(cards[3].description).toBe("Por cada USDC, ponderada por monto");
    expect(cards[4].description).toBe(pair.best.date);
    expect(cards[5].description).toBe(pair.worst.date);
    expect(cards[6].description).toBe(pair.last.date);
  });
});
