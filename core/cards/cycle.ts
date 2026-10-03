import { dateInMonth } from "@/core/expenses/recurrence";
import { monthOf, shiftMonth } from "@/core/summary/month";

// The billing cycle of a card. Everything works on "YYYY-MM-DD" and "YYYY-MM" strings and on UTC,
// so results never depend on the machine's time zone. A day a month does not have (the 31st of
// April) means that month's last day, both for the closing day and for the due day.

// The month whose statement a purchase lands in, which is the month that statement closes. A
// purchase made on or before the closing day belongs to the statement closing that very month; one
// made after it, to the statement closing the next month.
export const statementClosingMonth = (
  purchaseDate: string,
  closingDay: number,
): string => {
  const month = monthOf(purchaseDate);

  // ISO dates compare correctly as text.
  return purchaseDate <= dateInMonth(month, closingDay)
    ? month
    : shiftMonth(month, 1);
};

// The day the statement a purchase lands in closes.
export const statementClosingDate = (
  purchaseDate: string,
  closingDay: number,
): string =>
  dateInMonth(statementClosingMonth(purchaseDate, closingDay), closingDay);

// The date the first installment of a purchase is paid: the due day of its statement. A statement
// is paid in the month it closes when its due day is after the closing day, and in the following
// month otherwise (the due day is compared as written, before any month shortens it).
export const firstInstallmentDate = (
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): string => {
  const closingMonth = statementClosingMonth(purchaseDate, closingDay);
  const dueMonth =
    dueDay > closingDay ? closingMonth : shiftMonth(closingMonth, 1);

  return dateInMonth(dueMonth, dueDay);
};

// The month the first installment counts in: the month its statement is paid.
export const firstInstallmentMonth = (
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): string => monthOf(firstInstallmentDate(purchaseDate, closingDay, dueDay));
