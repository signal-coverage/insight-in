import { describe, expect, it } from "vitest";

import { hiddenSummaryCurrenciesSchema } from "./schema";

describe("hiddenSummaryCurrenciesSchema", () => {
  it("accepts legal tender and crypto codes, and an empty list", () => {
    expect(hiddenSummaryCurrenciesSchema.parse(["USD", "USDC"])).toEqual([
      "USD",
      "USDC",
    ]);
    expect(hiddenSummaryCurrenciesSchema.parse([])).toEqual([]);
  });

  it("trims, capitalises and removes repeats, keeping the first order", () => {
    expect(
      hiddenSummaryCurrenciesSchema.parse([" usd ", "eur", "USD"]),
    ).toEqual(["USD", "EUR"]);
  });

  it("refuses an unknown code with a field message in Spanish", () => {
    const result = hiddenSummaryCurrenciesSchema.safeParse(["USD", "ZZZ"]);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Elegí solo monedas que la app soporta.",
    );
  });

  it.each(["USD", null, [1], [""], Array.from({ length: 200 }, () => "USD")])(
    "refuses %j",
    (value) => {
      expect(hiddenSummaryCurrenciesSchema.safeParse(value).success).toBe(
        false,
      );
    },
  );
});
