import { dateInMonth, dayOfMonthOf } from "@/core/expenses/recurrence";
import { toMinorUnits } from "@/core/incomes/money";
import { monthOf, shiftMonth } from "@/core/summary/month";

import type { AmountMode, PlannedInstallment } from "./types";

// Pure logic of a purchase paid in installments. Everything works on minor units, "YYYY-MM-DD"
// and "YYYY-MM" strings and on UTC, so results never depend on the machine's time zone.

// Divides the total into `count` installments, all in minor units. Each one gets the integer
// division and the first (total mod count) get one extra minor unit, so they add up exactly to the
// total and never differ by more than one minor unit.
export const splitAmount = (total: number, count: number): number[] => {
  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
};

// The k-th installment (0-based) falls on the day of the first one, in the month k after it. A
// month too short for that day uses its last day, and the next one goes back to the day.
export const installmentDates = (
  firstDate: string,
  count: number,
): string[] => {
  const day = dayOfMonthOf(firstDate);
  const firstMonth = monthOf(firstDate);

  return Array.from({ length: count }, (_, index) =>
    dateInMonth(shiftMonth(firstMonth, index), day),
  );
};

// "Heladera (3/12)".
export const installmentDescription = (
  product: string,
  number: number,
  count: number,
): string => `${product} (${number}/${count})`;

// The month of the last installment.
export const lastInstallmentMonth = (
  firstDate: string,
  count: number,
): string => shiftMonth(monthOf(firstDate), count - 1);

// The total of the purchase in minor units from what the user typed: the whole amount, or the
// amount of one installment times how many there are. Null when the text is not a positive amount
// in the currency or the total is beyond what can be stored exactly.
export const planTotal = (
  amount: string,
  mode: AmountMode,
  count: number,
  currency: string,
): number | null => {
  const minorUnits = toMinorUnits(amount, currency);

  if (minorUnits === null || minorUnits <= 0) {
    return null;
  }

  const total = mode === "total" ? minorUnits : minorUnits * count;

  return Number.isSafeInteger(total) ? total : null;
};

// Every installment of a plan, ready to be stored, in installment order.
export const buildInstallments = ({
  description,
  totalAmount,
  totalCuotas,
  firstDate,
}: {
  description: string;
  totalAmount: number;
  totalCuotas: number;
  firstDate: string;
}): PlannedInstallment[] => {
  const amounts = splitAmount(totalAmount, totalCuotas);
  const dates = installmentDates(firstDate, totalCuotas);

  return amounts.map((amount, index) => ({
    number: index + 1,
    description: installmentDescription(description, index + 1, totalCuotas),
    amount,
    date: dates[index],
  }));
};
