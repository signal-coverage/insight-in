import { describe, expect, it } from "vitest";

import { readLimitRows } from "./formLimits";

const formWith = (currencies: string[], amounts: string[]): FormData => {
  const formData = new FormData();

  currencies.forEach((currency) => formData.append("limitCurrency", currency));
  amounts.forEach((amount) => formData.append("limitAmount", amount));

  return formData;
};

describe("readLimitRows", () => {
  it("pairs each currency with the amount sent in the same position", () => {
    expect(readLimitRows(formWith(["ARS", "USD"], ["300000", "1000"]))).toEqual(
      [
        { currency: "ARS", amount: "300000" },
        { currency: "USD", amount: "1000" },
      ],
    );
  });

  it("gives a row with a missing half an empty value, for the schema to refuse", () => {
    expect(readLimitRows(formWith(["ARS", "USD"], ["300000"]))).toEqual([
      { currency: "ARS", amount: "300000" },
      { currency: "USD", amount: "" },
    ]);
  });

  it("is empty when the form sends no cap (a debit card)", () => {
    expect(readLimitRows(new FormData())).toEqual([]);
  });
});
