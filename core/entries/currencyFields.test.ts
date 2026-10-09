import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  checkAmount,
  currencyField,
  legalTenderCurrencyField,
  toAmount,
} from "./fields";

const UNSUPPORTED = "Selecciona una moneda compatible.";

const amountSchema = z
  .object({ amount: z.string(), currency: currencyField })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);
  })
  .transform(toAmount);

const issuesOf = (input: unknown): string[] => {
  const result = amountSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
};

describe("currencyField", () => {
  it.each(["ARS", "USD", "JPY"])("accepts the legal tender %s", (code) => {
    expect(currencyField.safeParse(code).success).toBe(true);
  });

  it.each(["USDC", "BTC", "XMR"])("accepts the crypto asset %s too", (code) => {
    expect(currencyField.safeParse(code).success).toBe(true);
  });

  it.each(["ZZZ", "usdc", "", "XRP"])("refuses %j", (code) => {
    expect(currencyField.safeParse(code).error?.issues[0].message).toBe(
      UNSUPPORTED,
    );
  });
});

describe("legalTenderCurrencyField", () => {
  it("accepts legal tender", () => {
    expect(legalTenderCurrencyField.safeParse("ARS").success).toBe(true);
  });

  it.each(["USDC", "BTC"])(
    "refuses the crypto asset %s with the usual message",
    (code) => {
      expect(
        legalTenderCurrencyField.safeParse(code).error?.issues[0].message,
      ).toBe(UNSUPPORTED);
    },
  );
});

describe("checkAmount with a crypto currency", () => {
  it("turns up to 6 decimals into millionths", () => {
    expect(amountSchema.parse({ amount: "1.5", currency: "USDC" })).toBe(
      1500000,
    );
    expect(amountSchema.parse({ amount: "0.000001", currency: "BTC" })).toBe(1);
  });

  it("refuses a seventh decimal on the amount instead of skipping the check", () => {
    expect(issuesOf({ amount: "1.1234567", currency: "USDC" })).toEqual([
      "amount: Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ]);
  });

  it("refuses zero", () => {
    expect(issuesOf({ amount: "0", currency: "ETH" })).toEqual([
      "amount: El monto debe ser mayor que cero.",
    ]);
  });
});
