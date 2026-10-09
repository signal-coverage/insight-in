import { describe, expect, it } from "vitest";

import type { Income } from "@/core/incomes/types";
import type { InstallmentPlanItem } from "@/core/installments/types";

import { toIncomeRows, toReimbursableOptions, toRepaymentData } from "./utils";

const INCOME: Income = {
  id: "inc_1",
  description: "Sueldo",
  amount: 1200000,
  currency: "ARS",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Sueldo",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  originCurrency: null,
  originAmount: null,
  reimbursesExpenseId: null,
  reimbursesExpenseDescription: null,
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
};

describe("toIncomeRows installment plans", () => {
  const INSTALLMENT = {
    ...INCOME,
    installmentPlanId: "plan_1",
    installmentNumber: 1,
  };

  it("hands each installment the progress of its plan", () => {
    const [row] = toIncomeRows([INSTALLMENT], {
      plan_1: { total: 6, settled: 2 },
    });

    expect(row.planProgress).toEqual({ total: 6, settled: 2 });
  });

  it("leaves it out for an income that is not an installment, and when the plan is not known", () => {
    const [plain, unknown] = toIncomeRows([INCOME, INSTALLMENT], {
      other: { total: 2, settled: 0 },
    });

    expect(plain).not.toHaveProperty("planProgress");
    expect(unknown).not.toHaveProperty("planProgress");
  });

  it("works without any progress at all", () => {
    expect(toIncomeRows([INSTALLMENT])[0]).not.toHaveProperty("planProgress");
  });
});

describe("toIncomeRows reimbursement", () => {
  it("has no reimbursement tooltip for an income that pays nothing back", () => {
    const [row] = toIncomeRows([INCOME]);

    expect(row.reimbursementTooltip).toBeNull();
  });

  it("names the expense an income pays back in the tooltip", () => {
    const [row] = toIncomeRows([
      {
        ...INCOME,
        reimbursesExpenseId: "exp_1",
        reimbursesExpenseDescription: "Dentista",
      },
    ]);

    expect(row.reimbursementTooltip).toBe("Devolución de: Dentista");
  });
});

describe("toReimbursableOptions", () => {
  const EXPENSES = [
    {
      id: "exp_1",
      description: "Dentista",
      date: "2026-09-12",
      currency: "ARS",
      outstanding: 400000,
    },
    {
      id: "exp_2",
      description: "Préstamo a Juan",
      date: "2026-08-01",
      currency: "USD",
      outstanding: 5000,
    },
  ];

  it("offers each expense with its description, its day and what is still owed, in its own currency", () => {
    const [ars, usd] = toReimbursableOptions(EXPENSES);

    expect(ars).toMatchObject({ id: "exp_1", currency: "ARS" });
    expect(ars.label).toMatch(/^Dentista · 12\/09 · faltan \$\s4\.000,00$/);
    expect(usd).toMatchObject({ id: "exp_2", currency: "USD" });
    expect(usd.label).toMatch(
      /^Préstamo a Juan · 01\/08 · faltan US\$\s50,00$/,
    );
  });

  it("keeps the order it is given", () => {
    expect(toReimbursableOptions(EXPENSES).map(({ id }) => id)).toEqual([
      "exp_1",
      "exp_2",
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(toReimbursableOptions([])).toEqual([]);
  });
});

describe("toIncomeRows origin", () => {
  it("has no origin strings for an ordinary income", () => {
    const [row] = toIncomeRows([INCOME]);

    expect(row).toMatchObject({
      originAmountDecimal: null,
      originLabel: null,
      originTooltip: null,
    });
  });

  it("names the origin for the marker and gives its tooltip the amount and the implied rate", () => {
    // 12.000,00 ARS that came from 10 USDC.
    const [row] = toIncomeRows([
      { ...INCOME, originCurrency: "USDC", originAmount: 10000000 },
    ]);

    expect(row.originLabel).toBe("Viene de 10 USDC");
    expect(row.originTooltip).toBe("Viene de 10,00 USDC · cotización 1.200,00");
    expect(row.originAmountDecimal).toBe("10.00");
  });

  it("formats an ISO origin with its own decimals", () => {
    const [row] = toIncomeRows([
      {
        ...INCOME,
        currency: "USD",
        amount: 99000,
        originCurrency: "EUR",
        originAmount: 100050,
      },
    ]);

    expect(row.originLabel).toBe("Viene de 1.000,50 EUR");
    expect(row.originTooltip).toMatch(
      /^Viene de EUR\s1\.000,50 · cotización 0,9895$/,
    );
    expect(row.originAmountDecimal).toBe("1000.50");
  });

  it("keeps the net amount label as it was", () => {
    const [row] = toIncomeRows([
      { ...INCOME, originCurrency: "USDC", originAmount: 10000000 },
    ]);

    expect(row.amountLabel).toMatch(/^\$\s12\.000,00$/);
    expect(row.amountDecimal).toBe("12000.00");
  });
});

const LOAN: InstallmentPlanItem = {
  id: "plan_1",
  description: "Préstamo a Juan",
  categoryName: "Préstamos",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
};

describe("toRepaymentData", () => {
  it("names the month for the title of the drawer", () => {
    expect(toRepaymentData({ month: "2026-10", plans: [] })).toEqual({
      month: "2026-10",
      monthLabel: "Octubre de 2026",
      plans: [],
    });
  });

  it("gives each loan its formatted next amount and its progress", () => {
    const { plans } = toRepaymentData({ month: "2026-10", plans: [LOAN] });

    expect(plans[0]).toMatchObject({
      ...LOAN,
      progressLabel: "3 de 12 · quedan 9",
    });
    expect(plans[0].nextAmountLabel).toMatch(/^\$\s100\.000,00$/);
  });

  it("says 'queda' when a single installment is left", () => {
    const { plans } = toRepaymentData({
      month: "2026-10",
      plans: [{ ...LOAN, doneCount: 11, pendingCount: 1 }],
    });

    expect(plans[0].progressLabel).toBe("11 de 12 · queda 1");
  });

  it("keeps the order of the loans", () => {
    const { plans } = toRepaymentData({
      month: "2026-10",
      plans: [LOAN, { ...LOAN, id: "plan_2" }],
    });

    expect(plans.map(({ id }) => id)).toEqual(["plan_1", "plan_2"]);
  });
});
