import { describe, expect, it } from "vitest";

import { openingBalanceInputSchema } from "./schema";

const valid = {
  month: "2026-06",
  balances: [{ currency: "ARS", digital: "1500.50", cash: "200" }],
};

const issuePaths = (input: unknown): string[] => {
  const result = openingBalanceInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("openingBalanceInputSchema", () => {
  it("turns each amount into minor units of its currency", () => {
    const result = openingBalanceInputSchema.parse(valid);

    expect(result).toEqual({
      month: "2026-06",
      amounts: [
        { currency: "ARS", medium: "DIGITAL", amount: 150050 },
        { currency: "ARS", medium: "CASH", amount: 20000 },
      ],
    });
  });

  it("respects the decimals of each currency", () => {
    const result = openingBalanceInputSchema.parse({
      month: "2026-06",
      balances: [{ currency: "JPY", digital: "1500", cash: "" }],
    });

    expect(result.amounts).toEqual([
      { currency: "JPY", medium: "DIGITAL", amount: 1500 },
    ]);
  });

  it("leaves out a field that is empty or only spaces: it means no amount", () => {
    const result = openingBalanceInputSchema.parse({
      month: "2026-06",
      balances: [{ currency: "ARS", digital: "   ", cash: "" }],
    });

    expect(result.amounts).toEqual([]);
  });

  it("keeps an explicit zero: it is an amount, not a missing one", () => {
    const result = openingBalanceInputSchema.parse({
      month: "2026-06",
      balances: [{ currency: "ARS", digital: "0", cash: "" }],
    });

    expect(result.amounts).toEqual([
      { currency: "ARS", medium: "DIGITAL", amount: 0 },
    ]);
  });

  it("accepts no currency at all: that clears the opening balance", () => {
    expect(
      openingBalanceInputSchema.parse({ month: "2026-06", balances: [] })
        .amounts,
    ).toEqual([]);
  });

  it("rejects a negative amount, pointing at the field", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [{ currency: "ARS", digital: "-5", cash: "" }],
      }),
    ).toEqual(["balances.0.digital"]);
  });

  it("rejects an amount that is not a number", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [{ currency: "ARS", digital: "", cash: "abc" }],
      }),
    ).toEqual(["balances.0.cash"]);
  });

  it("rejects more decimals than the currency has", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [{ currency: "ARS", digital: "1.005", cash: "" }],
      }),
    ).toEqual(["balances.0.digital"]);
  });

  it("says what is wrong with an amount, in Spanish", () => {
    const result = openingBalanceInputSchema.safeParse({
      ...valid,
      balances: [{ currency: "ARS", digital: "x", cash: "" }],
    });

    expect(result.error?.issues[0].message).toBe(
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    );
  });

  it.each(["2026-13", "2026-6", "1999-12", "2100-01", "", "junio"])(
    "rejects the month %j",
    (month) => {
      expect(issuePaths({ ...valid, month })).toEqual(["month"]);
    },
  );

  it("rejects a missing month", () => {
    expect(issuePaths({ balances: valid.balances })).toEqual(["month"]);
  });

  it("rejects a currency that is not supported", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [{ currency: "XXX", digital: "1", cash: "" }],
      }),
    ).toEqual(["balances.0.currency"]);
  });

  it("rejects the same currency twice", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [
          { currency: "ARS", digital: "1", cash: "" },
          { currency: "ARS", digital: "2", cash: "" },
        ],
      }),
    ).toEqual(["balances.1.currency"]);
  });

  it("rejects something that is not a list of balances", () => {
    expect(issuePaths({ ...valid, balances: "nope" })).toEqual(["balances"]);
    expect(issuePaths(null)).not.toEqual([]);
  });
});
