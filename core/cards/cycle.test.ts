import { describe, expect, it } from "vitest";

import {
  firstInstallmentDate,
  firstInstallmentMonth,
  statementClosingDate,
  statementClosingMonth,
} from "./cycle";

// Closing on the 25th and paying on the 5th: the due day comes before the closing day, so the
// statement is paid in the month after it closes.
const CLOSING_25_DUE_5 = [25, 5] as const;

describe("statementClosingMonth", () => {
  it("is the month of the purchase when it is made before the closing day", () => {
    expect(statementClosingMonth("2026-10-10", 25)).toBe("2026-10");
  });

  it("is the month of the purchase when it is made exactly on the closing day", () => {
    expect(statementClosingMonth("2026-10-25", 25)).toBe("2026-10");
  });

  it("is the next month when the purchase is made after the closing day", () => {
    expect(statementClosingMonth("2026-10-26", 25)).toBe("2026-11");
  });

  it("rolls the year over for a purchase made after the closing day of December", () => {
    expect(statementClosingMonth("2026-12-28", 25)).toBe("2027-01");
  });

  it("reads a closing day the month does not have as its last day", () => {
    // April has 30 days: closing on the 31st means closing on the 30th.
    expect(statementClosingMonth("2026-04-30", 31)).toBe("2026-04");
    // February 2026 has 28 days.
    expect(statementClosingMonth("2026-02-28", 31)).toBe("2026-02");
    expect(statementClosingMonth("2026-02-28", 30)).toBe("2026-02");
  });

  it("reads the closing day of February in a leap year as the 29th", () => {
    expect(statementClosingMonth("2028-02-29", 31)).toBe("2028-02");
    expect(statementClosingMonth("2028-02-28", 31)).toBe("2028-02");
  });

  it("does not move the closing of a month that does have that day", () => {
    // January has 31 days, so a closing on the 31st is the 31st.
    expect(statementClosingMonth("2026-01-31", 31)).toBe("2026-01");
  });
});

describe("firstInstallmentDate", () => {
  it("is the due day of the month after the closing one, when the due day is before the closing day", () => {
    const [closing, due] = CLOSING_25_DUE_5;

    expect(firstInstallmentDate("2026-10-10", closing, due)).toBe("2026-11-05");
  });

  it("is the same for a purchase made exactly on the closing day", () => {
    const [closing, due] = CLOSING_25_DUE_5;

    expect(firstInstallmentDate("2026-10-25", closing, due)).toBe("2026-11-05");
  });

  it("falls one month later for a purchase made the day after the closing day", () => {
    const [closing, due] = CLOSING_25_DUE_5;

    expect(firstInstallmentDate("2026-10-26", closing, due)).toBe("2026-12-05");
  });

  it("is in the same month the statement closes when the due day is after the closing day", () => {
    expect(firstInstallmentDate("2026-10-03", 5, 15)).toBe("2026-10-15");
    expect(firstInstallmentDate("2026-10-05", 5, 15)).toBe("2026-10-15");
    expect(firstInstallmentDate("2026-10-06", 5, 15)).toBe("2026-11-15");
  });

  it("is in the following month when the due day is the closing day", () => {
    expect(firstInstallmentDate("2026-10-10", 10, 10)).toBe("2026-11-10");
    expect(firstInstallmentDate("2026-10-11", 10, 10)).toBe("2026-12-10");
  });

  it("rolls the year over", () => {
    const [closing, due] = CLOSING_25_DUE_5;

    // Closes in December, paid in January.
    expect(firstInstallmentDate("2026-12-20", closing, due)).toBe("2027-01-05");
    // Closes in January, paid in February.
    expect(firstInstallmentDate("2026-12-28", closing, due)).toBe("2027-02-05");
    // The due day is after the closing day, so it is paid in the month it closes.
    expect(firstInstallmentDate("2026-11-20", 25, 28)).toBe("2026-11-28");
    expect(firstInstallmentDate("2026-12-27", 25, 28)).toBe("2027-01-28");
  });

  it("reads a due day the month does not have as its last day", () => {
    // Closing on the 25th, paid on the 31st, in the same month: April has 30 days.
    expect(firstInstallmentDate("2026-04-10", 25, 31)).toBe("2026-04-30");
    // February 2027 has 28 days, and 2028 is a leap year.
    expect(firstInstallmentDate("2027-02-10", 25, 31)).toBe("2027-02-28");
    expect(firstInstallmentDate("2028-02-10", 25, 31)).toBe("2028-02-29");
  });

  it("reads a due day the following month does not have as its last day", () => {
    // Closes on the 31st, paid on the 30th of the next month: February has no 30th.
    expect(firstInstallmentDate("2026-01-10", 31, 30)).toBe("2026-02-28");
    expect(firstInstallmentDate("2028-01-10", 31, 30)).toBe("2028-02-29");
  });

  it("combines a clamped closing day with a due day in the following month", () => {
    // Closing on the 31st in April is the 30th: this purchase is still in the April statement.
    expect(firstInstallmentDate("2026-04-30", 31, 10)).toBe("2026-05-10");
    // Closing on the 31st of February, and a purchase on its last day.
    expect(firstInstallmentDate("2026-02-28", 31, 10)).toBe("2026-03-10");
  });

  it("only changes the closing day for a short month, not for a long one", () => {
    // The 30th is after a closing on the 29th, but not after a closing on the 30th.
    expect(firstInstallmentDate("2026-03-30", 29, 10)).toBe("2026-05-10");
    expect(firstInstallmentDate("2026-03-30", 30, 10)).toBe("2026-04-10");
  });
});

describe("firstInstallmentMonth", () => {
  it("is the month of the first installment's date", () => {
    expect(firstInstallmentMonth("2026-10-10", 25, 5)).toBe("2026-11");
    expect(firstInstallmentMonth("2026-12-28", 25, 5)).toBe("2027-02");
    expect(firstInstallmentMonth("2026-10-03", 5, 15)).toBe("2026-10");
  });
});

describe("statementClosingDate", () => {
  it("is the closing day of the month of the purchase when it is made on or before it", () => {
    expect(statementClosingDate("2026-10-10", 25)).toBe("2026-10-25");
    expect(statementClosingDate("2026-10-25", 25)).toBe("2026-10-25");
  });

  it("is the closing day of the next month when the purchase is made after it", () => {
    expect(statementClosingDate("2026-10-26", 25)).toBe("2026-11-25");
    expect(statementClosingDate("2026-12-28", 25)).toBe("2027-01-25");
  });

  it("reads a closing day the month does not have as its last day", () => {
    expect(statementClosingDate("2026-04-10", 31)).toBe("2026-04-30");
    expect(statementClosingDate("2028-02-10", 31)).toBe("2028-02-29");
  });
});
