import { describe, expect, it } from "vitest";

import type { RecurringExpenseItem } from "@/core/expenses/types";
import type { InstallmentPlanItem } from "@/core/installments/types";

import { toExpenseRows, toRecurringData } from "./utils";

const EXPENSE = {
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  status: "SETTLED" as const,
  isRecurring: true,
};

describe("toExpenseRows installment plans", () => {
  const INSTALLMENT = {
    ...EXPENSE,
    installmentPlanId: "plan_1",
    installmentNumber: 2,
  };

  it("hands each installment the progress of its plan", () => {
    const [row] = toExpenseRows([INSTALLMENT], {
      plan_1: { total: 12, settled: 3 },
    });

    expect(row.planProgress).toEqual({ total: 12, settled: 3 });
  });

  it("leaves it out for an expense that is not an installment, and when the plan is not known", () => {
    const [plain, unknown] = toExpenseRows([EXPENSE, INSTALLMENT], {
      other: { total: 2, settled: 0 },
    });

    expect(plain).not.toHaveProperty("planProgress");
    expect(unknown).not.toHaveProperty("planProgress");
  });

  it("works without any progress at all", () => {
    expect(toExpenseRows([INSTALLMENT])[0]).not.toHaveProperty("planProgress");
  });
});

describe("toExpenseRows", () => {
  it("adds the formatted amount, the decimal amount for the form and the formatted date", () => {
    const [row] = toExpenseRows([EXPENSE]);

    expect(row).toMatchObject({
      ...EXPENSE,
      amountDecimal: "350000.50",
      dateLabel: "5 sept 2026",
    });
    expect(row.amountLabel).toMatch(/^\$\s350\.000,50$/);
  });

  it("has no origin strings for an ordinary expense", () => {
    const [row] = toExpenseRows([EXPENSE]);

    expect(row).toMatchObject({
      originAmountDecimal: null,
      originLabel: null,
      originTooltip: null,
    });
  });

  it("names the price it was quoted in for the marker and gives its tooltip the amount and the implied rate", () => {
    // A 20 USD subscription that really cost 35.000 ARS.
    const [row] = toExpenseRows([
      {
        ...EXPENSE,
        amount: 3500000,
        originCurrency: "USD",
        originAmount: 2000,
      },
    ]);

    expect(row.originLabel).toBe("Se cotizó en 20 USD");
    expect(row.originTooltip).toMatch(
      /^Se cotizó en US\$\s20,00 · cotización 1\.750,00$/,
    );
    expect(row.originAmountDecimal).toBe("20.00");
  });

  it("formats a crypto price with its own decimals", () => {
    const [row] = toExpenseRows([
      {
        ...EXPENSE,
        amount: 3500000,
        originCurrency: "USDC",
        originAmount: 20000000,
      },
    ]);

    expect(row.originLabel).toBe("Se cotizó en 20 USDC");
    expect(row.originAmountDecimal).toBe("20.00");
  });

  it("has no reimbursement strings for an expense that expects none", () => {
    const [row] = toExpenseRows([EXPENSE]);

    expect(row).toMatchObject({
      expectedReimbursementDecimal: null,
      reimbursementTooltip: null,
    });
  });

  it("tells how much is still owed out of what is expected, and gives the expected amount for the form", () => {
    const [row] = toExpenseRows([
      {
        ...EXPENSE,
        amount: 1000000,
        expectedReimbursement: 1000000,
        reimbursementReceived: 600000,
      },
    ]);

    expect(row.expectedReimbursementDecimal).toBe("10000.00");
    expect(row.reimbursementTooltip).toMatch(
      /^Te deben \$\s4\.000,00 de \$\s10\.000,00$/,
    );
  });

  it("owes everything when nothing came back yet", () => {
    const [row] = toExpenseRows([
      { ...EXPENSE, expectedReimbursement: 1000000, reimbursementReceived: 0 },
    ]);

    expect(row.reimbursementTooltip).toMatch(/^Te deben \$\s10\.000,00$/);
  });

  it("says the reimbursement is complete once nothing is owed, even if more than expected came back", () => {
    const [exact, over] = toExpenseRows([
      {
        ...EXPENSE,
        expectedReimbursement: 1000000,
        reimbursementReceived: 1000000,
      },
      {
        ...EXPENSE,
        id: "exp_2",
        expectedReimbursement: 1000000,
        reimbursementReceived: 1500000,
      },
    ]);

    expect(exact.reimbursementTooltip).toBe("Reintegro completo");
    expect(over.reimbursementTooltip).toBe("Reintegro completo");
  });

  it("keeps the order it is given", () => {
    const rows = toExpenseRows([EXPENSE, { ...EXPENSE, id: "exp_2" }]);

    expect(rows.map((row) => row.id)).toEqual(["exp_1", "exp_2"]);
  });

  it("returns nothing for nothing", () => {
    expect(toExpenseRows([])).toEqual([]);
  });
});

const TEMPLATE: RecurringExpenseItem = {
  id: "rec_1",
  description: "Rent",
  amount: 35000050,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
  decision: null,
};

const PLAN: InstallmentPlanItem = {
  id: "plan_1",
  description: "Heladera",
  categoryName: "Hogar",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
};

describe("toRecurringData", () => {
  it("names the month the templates are resolved for", () => {
    expect(toRecurringData({ month: "2026-10", items: [] })).toMatchObject({
      month: "2026-10",
      monthLabel: "Octubre de 2026",
    });
  });

  it("adds the formatted amount, the decimal amount for the input and the day", () => {
    const { pending } = toRecurringData({
      month: "2026-10",
      items: [TEMPLATE],
    });

    expect(pending[0]).toMatchObject({
      ...TEMPLATE,
      amountDecimal: "350000.50",
      dayLabel: "Día 5",
    });
    expect(pending[0].amountLabel).toMatch(/^\$\s350\.000,50$/);
  });

  it("has no reference for a template without a reference price", () => {
    const { pending } = toRecurringData({
      month: "2026-10",
      items: [TEMPLATE],
    });

    expect(pending[0]).toMatchObject({
      originAmountDecimal: null,
      referenceLabel: null,
    });
  });

  it("gives a template with a reference price its reference line and the amount for the form", () => {
    const { pending, decided } = toRecurringData({
      month: "2026-10",
      items: [
        { ...TEMPLATE, originCurrency: "USD", originAmount: 2000 },
        {
          ...TEMPLATE,
          id: "rec_2",
          decision: "ENABLED",
          originCurrency: "USDC",
          originAmount: 20000000,
        },
      ],
    });

    expect(pending[0].referenceLabel).toMatch(/^Referencia: US\$\s20,00$/);
    expect(pending[0].originAmountDecimal).toBe("20.00");
    expect(decided[0].referenceLabel).toBe("Referencia: 20,00 USDC");
  });

  it("lists the templates without a decision first and apart from the decided ones", () => {
    const decided = { ...TEMPLATE, id: "rec_2", decision: "ENABLED" as const };
    const { pending, decided: done } = toRecurringData({
      month: "2026-10",
      items: [decided, TEMPLATE],
    });

    expect(pending.map(({ id }) => id)).toEqual(["rec_1"]);
    expect(done.map(({ id }) => id)).toEqual(["rec_2"]);
  });

  it("has no installment plans unless some are given", () => {
    expect(toRecurringData({ month: "2026-10", items: [] }).plans).toEqual([]);
  });

  it("adds to each installment plan its formatted next amount and its progress", () => {
    const { plans } = toRecurringData({
      month: "2026-10",
      items: [],
      plans: [PLAN],
    });

    expect(plans[0]).toMatchObject({
      ...PLAN,
      progressLabel: "3 de 12 · quedan 9",
    });
    expect(plans[0].nextAmountLabel).toMatch(/^\$\s100\.000,00$/);
  });

  it("says 'queda' when a single installment is left", () => {
    const { plans } = toRecurringData({
      month: "2026-10",
      items: [],
      plans: [{ ...PLAN, doneCount: 11, pendingCount: 1 }],
    });

    expect(plans[0].progressLabel).toBe("11 de 12 · queda 1");
  });

  it("counts how many are still waiting", () => {
    const decided = { ...TEMPLATE, id: "rec_2", decision: "DISABLED" as const };

    expect(
      toRecurringData({
        month: "2026-10",
        items: [TEMPLATE, { ...TEMPLATE, id: "rec_3" }, decided],
      }).pendingCount,
    ).toBe(2);
  });
});
