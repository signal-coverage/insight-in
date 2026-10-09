import { describe, expect, it } from "vitest";

import { bankAcceptsCurrency } from "./kinds";

describe("bankAcceptsCurrency", () => {
  it("lets an entity hold legal tender, and nothing else", () => {
    expect(bankAcceptsCurrency("ENTITY", "ARS")).toBe(true);
    expect(bankAcceptsCurrency("ENTITY", "USD")).toBe(true);
    expect(bankAcceptsCurrency("ENTITY", "USDC")).toBe(false);
    expect(bankAcceptsCurrency("ENTITY", "BTC")).toBe(false);
  });

  it("lets a virtual wallet hold legal tender and every crypto asset of the registry", () => {
    expect(bankAcceptsCurrency("WALLET", "ARS")).toBe(true);
    expect(bankAcceptsCurrency("WALLET", "USDC")).toBe(true);
    expect(bankAcceptsCurrency("WALLET", "TRX")).toBe(true);
  });

  it("refuses an unknown code for either kind", () => {
    expect(bankAcceptsCurrency("WALLET", "ZZZ")).toBe(false);
    expect(bankAcceptsCurrency("ENTITY", "ZZZ")).toBe(false);
  });
});
