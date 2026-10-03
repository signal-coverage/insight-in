import { describe, expect, it } from "vitest";

import type { InstallmentPlanItem } from "@/core/installments/types";

import {
  firstError,
  installmentAmountLabel,
  installmentPreviewText,
  originRate,
  splitSummary,
  toInstallmentCounts,
  toOriginStrings,
  toInstallmentPlanRow,
  toPlanProgressField,
  toTotalRows,
  withPlanRows,
} from "./utils";

// The es-AR formatter separates the prefix with a no-break space, so a plain space in the
// expectation matches any whitespace.
const money = (text: string) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

  return expect.stringMatching(new RegExp(`^${escaped.replace(/ /g, "\\s")}$`));
};

describe("toTotalRows", () => {
  it("formats the total, the settled part and the pending part of each currency", () => {
    expect(
      toTotalRows([{ currency: "USD", total: 250000, settled: 100000 }]),
    ).toEqual([
      {
        currency: "USD",
        label: money("US$ 2.500,00"),
        settled: money("US$ 1.000,00"),
        pending: money("US$ 1.500,00"),
      },
    ]);
  });

  it("has nothing pending when everything is settled", () => {
    expect(
      toTotalRows([{ currency: "ARS", total: 5000, settled: 5000 }])[0].pending,
    ).toMatch(/0,00/);
  });

  it("keeps every currency apart and in the order it is given", () => {
    const rows = toTotalRows([
      { currency: "ARS", total: 100, settled: 0 },
      { currency: "USD", total: 200, settled: 200 },
    ]);

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
  });
});

const planItem = (
  patch: Partial<InstallmentPlanItem> = {},
): InstallmentPlanItem => ({
  id: "plan_1",
  description: "Heladera",
  categoryName: "Hogar",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
  ...patch,
});

describe("toInstallmentPlanRow", () => {
  it("keeps what the plan says and adds its formatted next amount and its progress", () => {
    const row = toInstallmentPlanRow(planItem());

    expect(row).toMatchObject({
      ...planItem(),
      progressLabel: "3 de 12 · quedan 9",
    });
    expect(row.nextAmountLabel).toMatch(/^\$\s100\.000,00$/);
  });

  it("says 'queda' when a single installment is left", () => {
    expect(
      toInstallmentPlanRow(planItem({ doneCount: 11, pendingCount: 1 }))
        .progressLabel,
    ).toBe("11 de 12 · queda 1");
  });

  it("formats the next amount in the currency of the plan", () => {
    expect(
      toInstallmentPlanRow(planItem({ currency: "USD", nextAmount: 250000 }))
        .nextAmountLabel,
    ).toMatch(/2.500,00/);
  });
});

describe("splitSummary", () => {
  it("is the amount of every installment when the total divides evenly", () => {
    expect(splitSummary(120000, 12)).toEqual({
      installmentAmount: 10000,
      isApproximate: false,
    });
  });

  it("is the first (and largest) installment, as an approximation, when it does not", () => {
    expect(splitSummary(100000, 3)).toEqual({
      installmentAmount: 33334,
      isApproximate: true,
    });
  });
});

describe("installmentAmountLabel", () => {
  it("formats the amount in its currency", () => {
    expect(installmentAmountLabel(10000, "ARS", false)).toMatch(/^\$\s100,00$/);
  });

  it("puts ≈ before it when it is only close to what each installment charges", () => {
    expect(installmentAmountLabel(33334, "ARS", true)).toMatch(
      /^≈ \$\s333,34$/,
    );
  });
});

describe("installmentPreviewText", () => {
  it("says how many installments of how much, and the total", () => {
    expect(
      installmentPreviewText({
        totalCuotas: 12,
        installmentAmount: 10000,
        isApproximate: false,
        totalAmount: 120000,
        currency: "ARS",
      }),
    ).toMatch(/^12 cuotas de \$\s100,00 · total \$\s1\.200,00$/);
  });

  it("marks the amount of an installment with ≈ when the total does not divide evenly", () => {
    expect(
      installmentPreviewText({
        totalCuotas: 3,
        installmentAmount: 33334,
        isApproximate: true,
        totalAmount: 100001,
        currency: "ARS",
      }),
    ).toMatch(/^3 cuotas de ≈ \$\s333,34 · total \$\s1\.000,01$/);
  });
});

describe("firstError", () => {
  it("is the first field error the server found", () => {
    expect(
      firstError({
        message: "Corrige los campos resaltados.",
        fieldErrors: { amount: ["El monto es obligatorio."], firstDate: ["x"] },
      }),
    ).toBe("El monto es obligatorio.");
  });

  it("falls back to the general message", () => {
    expect(firstError({ message: "Algo salió mal." })).toBe("Algo salió mal.");
    expect(firstError({ message: "Algo salió mal.", fieldErrors: {} })).toBe(
      "Algo salió mal.",
    );
  });
});

describe("toInstallmentCounts", () => {
  const plan = (id: string, defaultCount: number) =>
    toInstallmentPlanRow(planItem({ id, defaultCount }));

  it("sends only the plans whose count differs from the default", () => {
    expect(
      toInstallmentCounts([plan("a", 1), plan("b", 1), plan("c", 0)], {
        a: 1,
        b: 3,
        c: 2,
      }),
    ).toEqual([
      { planId: "b", count: 3 },
      { planId: "c", count: 2 },
    ]);
  });

  it("sends a count of zero when the default was one", () => {
    expect(toInstallmentCounts([plan("a", 1)], { a: 0 })).toEqual([
      { planId: "a", count: 0 },
    ]);
  });

  it("sends nothing for a plan nobody touched", () => {
    expect(toInstallmentCounts([plan("a", 1), plan("b", 0)], {})).toEqual([]);
  });

  it("keeps the order of the plans, not the order the counts were chosen in", () => {
    expect(
      toInstallmentCounts([plan("a", 1), plan("b", 1)], { b: 2, a: 0 }).map(
        ({ planId }) => planId,
      ),
    ).toEqual(["a", "b"]);
  });

  it("ignores a count for a plan that is no longer listed", () => {
    expect(toInstallmentCounts([plan("a", 1)], { gone: 2 })).toEqual([]);
  });
});

describe("toOriginStrings", () => {
  const entry = {
    amount: 3500000,
    currency: "ARS",
    originCurrency: "USD",
    originAmount: 2000,
  };

  it("has nothing for an entry without an origin", () => {
    expect(
      toOriginStrings(
        { ...entry, originCurrency: null, originAmount: null },
        "Se cotizó en",
      ),
    ).toEqual({
      originAmountDecimal: null,
      originLabel: null,
      originTooltip: null,
    });
  });

  it("names the origin with the prefix it is given, for the marker, the tooltip and the form", () => {
    expect(toOriginStrings(entry, "Se cotizó en")).toEqual({
      originAmountDecimal: "20.00",
      originLabel: "Se cotizó en 20 USD",
      originTooltip: expect.stringMatching(
        /^Se cotizó en US\$\s20,00 · cotización 1\.750,00$/,
      ),
    });
  });

  it("gives the tooltip no rate when the amount is not positive", () => {
    expect(
      toOriginStrings({ ...entry, amount: 0 }, "Viene de").originTooltip,
    ).toMatch(/^Viene de US\$\s20,00$/);
  });
});

describe("originRate", () => {
  const rate = (patch: Partial<Parameters<typeof originRate>[0]> = {}) =>
    originRate({
      netAmount: "35000",
      netCurrency: "ARS",
      originAmount: "20",
      originCurrency: "USD",
      ...patch,
    });

  it("says what one unit of the origin cost in the net currency", () => {
    expect(rate()).toMatch(/^1 USD = \$\s1\.750,00$/);
  });

  it.each([
    ["no origin currency", { originCurrency: null }],
    ["an empty origin amount", { originAmount: "" }],
    ["an invalid origin amount", { originAmount: "abc" }],
    ["a zero origin amount", { originAmount: "0" }],
    ["an empty net amount", { netAmount: "" }],
    ["an invalid net amount", { netAmount: "12,5" }],
    ["an origin equal to the net currency", { originCurrency: "ARS" }],
  ])("is hidden with %s", (_name, patch) => {
    expect(rate(patch)).toBeNull();
  });
});

describe("toPlanProgressField", () => {
  const PROGRESS = { plan_1: { total: 12, settled: 3 } };

  it("is the progress of the plan of the entry", () => {
    expect(toPlanProgressField("plan_1", PROGRESS)).toEqual({
      planProgress: { total: 12, settled: 3 },
    });
  });

  it("is nothing for an entry without a plan or with an unknown one", () => {
    expect(toPlanProgressField(null, PROGRESS)).toEqual({});
    expect(toPlanProgressField("plan_9", PROGRESS)).toEqual({});
  });
});

describe("withPlanRows", () => {
  const ROWS = [
    { id: "a", installmentPlanId: "plan_1" },
    { id: "b", installmentPlanId: "plan_2" },
    { id: "c", installmentPlanId: "plan_1" },
    { id: "d", installmentPlanId: null },
  ];

  it("adds the rows of the plans being deleted to the rows being deleted", () => {
    expect(withPlanRows(new Set(["d"]), new Set(["plan_1"]), ROWS)).toEqual(
      new Set(["d", "a", "c"]),
    );
  });

  it("returns the very same set when no plan is being deleted, so nothing re-renders for nothing", () => {
    const ids = new Set(["d"]);

    expect(withPlanRows(ids, new Set(), ROWS)).toBe(ids);
  });
});
