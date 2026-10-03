import { describe, expect, it } from "vitest";

import { mediumField } from "./fields";
import {
  DEFAULT_PAYMENT_MEDIUM,
  isPaymentMedium,
  PAYMENT_MEDIUMS,
} from "./medium";

describe("payment medium", () => {
  it("knows the two ways money moves: digital and cash", () => {
    expect([...PAYMENT_MEDIUMS]).toEqual(["DIGITAL", "CASH"]);
  });

  it("starts as digital", () => {
    expect(DEFAULT_PAYMENT_MEDIUM).toBe("DIGITAL");
  });

  it("recognises only the mediums it knows", () => {
    expect(isPaymentMedium("CASH")).toBe(true);
    expect(isPaymentMedium("DIGITAL")).toBe(true);
    expect(isPaymentMedium("cash")).toBe(false);
    expect(isPaymentMedium(undefined)).toBe(false);
  });
});

describe("mediumField", () => {
  it("defaults to digital when the form sends nothing", () => {
    expect(mediumField.parse(undefined)).toBe("DIGITAL");
  });

  it("accepts cash", () => {
    expect(mediumField.parse("CASH")).toBe("CASH");
  });

  it("rejects anything else with a message in Spanish", () => {
    const result = mediumField.safeParse("CARD");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Selecciona un medio válido.");
  });
});
