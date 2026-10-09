import { describe, expect, it } from "vitest";

import { accountLabel, labelOfAccount, WITH_ACCOUNT_LABEL } from "./label";

describe("accountLabel", () => {
  it("reads as 'Banco · Cuenta'", () => {
    expect(accountLabel("Banco Galicia", "Caja de ahorro")).toBe(
      "Banco Galicia · Caja de ahorro",
    );
  });

  it("keeps the names as the user wrote them", () => {
    expect(accountLabel("Efectivo", "Efectivo")).toBe("Efectivo · Efectivo");
  });
});

describe("labelOfAccount", () => {
  it("labels an account read with its bank", () => {
    expect(
      labelOfAccount({
        name: "Caja de ahorro",
        bank: { name: "Banco Galicia" },
      }),
    ).toBe("Banco Galicia · Caja de ahorro");
  });
});

describe("WITH_ACCOUNT_LABEL", () => {
  it("reads just the two names the label needs", () => {
    expect(WITH_ACCOUNT_LABEL).toEqual({
      account: { select: { name: true, bank: { select: { name: true } } } },
    });
  });
});
