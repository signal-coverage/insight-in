import { describe, expect, it } from "vitest";

import {
  buildInstallments,
  installmentDates,
  installmentDescription,
  lastInstallmentMonth,
  planTotal,
  splitAmount,
} from "./plan";

describe("splitAmount", () => {
  it("splits an even total into equal installments", () => {
    expect(splitAmount(120000, 12)).toEqual(Array(12).fill(10000));
  });

  it("gives the first installments one extra minor unit when it does not divide evenly", () => {
    expect(splitAmount(100, 3)).toEqual([34, 33, 33]);
    expect(splitAmount(101, 3)).toEqual([34, 34, 33]);
    expect(splitAmount(10, 4)).toEqual([3, 3, 2, 2]);
  });

  it("always adds up exactly to the total", () => {
    for (const [total, count] of [
      [1, 2],
      [999999, 7],
      [100000001, 60],
      [35000050, 12],
    ]) {
      const parts = splitAmount(total, count);

      expect(parts).toHaveLength(count);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
    }
  });

  it("never lets two installments differ by more than one minor unit, the larger ones first", () => {
    const parts = splitAmount(1000003, 9);

    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    expect([...parts].sort((a, b) => b - a)).toEqual(parts);
  });
});

describe("installmentDates", () => {
  it("puts one installment in each month, on the day of the first one", () => {
    expect(installmentDates("2026-10-15", 4)).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
    ]);
  });

  it("rolls over the year", () => {
    expect(installmentDates("2026-11-05", 3)).toEqual([
      "2026-11-05",
      "2026-12-05",
      "2027-01-05",
    ]);
  });

  it("uses the last day of a shorter month and goes back to the day afterwards", () => {
    expect(installmentDates("2026-01-31", 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("uses the 29th of February in a leap year", () => {
    expect(installmentDates("2027-12-31", 3)).toEqual([
      "2027-12-31",
      "2028-01-31",
      "2028-02-29",
    ]);
  });
});

describe("installmentDescription", () => {
  it("names the product with the number of the installment and how many there are", () => {
    expect(installmentDescription("Heladera", 3, 12)).toBe("Heladera (3/12)");
  });
});

describe("lastInstallmentMonth", () => {
  it("is the month of the last installment", () => {
    expect(lastInstallmentMonth("2026-10-15", 12)).toBe("2027-09");
    expect(lastInstallmentMonth("2026-10-31", 2)).toBe("2026-11");
  });

  it("is the month of the first one when there is a single installment", () => {
    expect(lastInstallmentMonth("2026-10-15", 1)).toBe("2026-10");
  });
});

describe("planTotal", () => {
  it("takes the amount as the total", () => {
    expect(planTotal("120000.50", "total", 12, "ARS")).toBe(12000050);
  });

  it("multiplies the amount of one installment by how many there are", () => {
    expect(planTotal("10000.50", "perInstallment", 12, "ARS")).toBe(12000600);
  });

  it("is null for an amount that does not read in the currency", () => {
    expect(planTotal("abc", "total", 12, "ARS")).toBeNull();
    expect(planTotal("10.123", "perInstallment", 3, "ARS")).toBeNull();
    expect(planTotal("", "total", 3, "ARS")).toBeNull();
  });

  it("is null for a zero amount", () => {
    expect(planTotal("0", "total", 3, "ARS")).toBeNull();
    expect(planTotal("0.00", "perInstallment", 3, "ARS")).toBeNull();
  });

  it("is null when the total is beyond what can be stored", () => {
    expect(
      planTotal("90071992547409.91", "perInstallment", 60, "ARS"),
    ).toBeNull();
  });

  it("is null for an unsupported currency", () => {
    expect(planTotal("100", "total", 3, "XXX")).toBeNull();
  });
});

describe("buildInstallments", () => {
  it("lays out every installment with its number, description, amount and date", () => {
    expect(
      buildInstallments({
        description: "Heladera",
        totalAmount: 101,
        totalCuotas: 3,
        firstDate: "2026-11-30",
      }),
    ).toEqual([
      {
        number: 1,
        description: "Heladera (1/3)",
        amount: 34,
        date: "2026-11-30",
      },
      {
        number: 2,
        description: "Heladera (2/3)",
        amount: 34,
        date: "2026-12-30",
      },
      {
        number: 3,
        description: "Heladera (3/3)",
        amount: 33,
        date: "2027-01-30",
      },
    ]);
  });
});
