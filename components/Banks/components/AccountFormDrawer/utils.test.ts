import { describe, expect, it } from "vitest";

import type { Bank } from "@/core/banks/types";

import {
  currencyForKind,
  kindOfBank,
  offersCrypto,
  pickDefaultBankId,
} from "./utils";

const BANK_A: Bank = {
  id: "a",
  name: "Efectivo",
  kind: "ENTITY",
  archived: false,
};
const BANK_B: Bank = {
  id: "b",
  name: "Banco Galicia",
  kind: "ENTITY",
  archived: false,
};
const WALLET: Bank = {
  id: "w",
  name: "Mercado Pago",
  kind: "WALLET",
  archived: false,
};

describe("pickDefaultBankId", () => {
  it("uses the bank that was asked for when it is one of the banks", () => {
    expect(pickDefaultBankId("b", [BANK_A, BANK_B])).toBe("b");
  });

  it("uses the only bank when there is exactly one and none was asked for", () => {
    expect(pickDefaultBankId(null, [BANK_A])).toBe("a");
  });

  it("chooses nothing when there are several banks and none was asked for", () => {
    expect(pickDefaultBankId(null, [BANK_A, BANK_B])).toBeUndefined();
  });

  it("ignores a bank that is not among the banks (an archived or unknown one)", () => {
    expect(pickDefaultBankId("gone", [BANK_A, BANK_B])).toBeUndefined();
    expect(pickDefaultBankId("gone", [BANK_A])).toBe("a");
  });

  it("chooses nothing when there are no banks", () => {
    expect(pickDefaultBankId(null, [])).toBeUndefined();
  });
});

describe("kindOfBank", () => {
  it("is the kind of the bank chosen", () => {
    expect(kindOfBank("w", [BANK_A, WALLET])).toBe("WALLET");
    expect(kindOfBank("a", [BANK_A, WALLET])).toBe("ENTITY");
  });

  it("is an entity when no bank is chosen or the bank is not among them", () => {
    expect(kindOfBank(null, [WALLET])).toBe("ENTITY");
    expect(kindOfBank("gone", [WALLET])).toBe("ENTITY");
  });
});

describe("offersCrypto", () => {
  it("offers the crypto currencies for a wallet", () => {
    expect(offersCrypto("WALLET", "ARS")).toBe(true);
  });

  it("offers them for an account that already holds one, so its currency always shows", () => {
    expect(offersCrypto("ENTITY", "USDC")).toBe(true);
  });

  it("does not offer them for an entity in legal tender", () => {
    expect(offersCrypto("ENTITY", "ARS")).toBe(false);
  });
});

describe("currencyForKind", () => {
  it("goes back to pesos when a crypto currency was chosen and the bank is an entity", () => {
    expect(currencyForKind("USDC", "ENTITY")).toBe("ARS");
  });

  it("keeps a legal-tender currency for an entity, and anything for a wallet", () => {
    expect(currencyForKind("USD", "ENTITY")).toBe("USD");
    expect(currencyForKind("USDC", "WALLET")).toBe("USDC");
  });
});
