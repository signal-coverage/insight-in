import { describe, expect, it } from "vitest";

import { offeredAccounts, resolveAccountId } from "./utils";

const ACCOUNTS = [
  {
    id: "galicia",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "cash",
    currency: "ARS",
    label: "Efectivo · Efectivo",
    archived: false,
  },
  { id: "old", currency: "ARS", label: "Banco Nación · Vieja", archived: true },
  {
    id: "dollars",
    currency: "USD",
    label: "Banco Galicia · Dólares",
    archived: false,
  },
];

const ids = (accounts: { id: string }[]) => accounts.map(({ id }) => id);

describe("offeredAccounts", () => {
  it("offers the active accounts in the currency of the movement, in the order given", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "ARS"))).toEqual(["galicia", "cash"]);
    expect(ids(offeredAccounts(ACCOUNTS, "USD"))).toEqual(["dollars"]);
  });

  it("offers nothing in a currency the user has no account in", () => {
    expect(offeredAccounts(ACCOUNTS, "EUR")).toEqual([]);
  });

  it("also offers the archived account the record already has, in its place", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "ARS", "old"))).toEqual([
      "galicia",
      "cash",
      "old",
    ]);
  });

  it("does not offer the kept archived account in another currency", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "USD", "old"))).toEqual(["dollars"]);
  });
});

describe("resolveAccountId", () => {
  it("keeps the choice while it is offered", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "cash")).toBe("cash");
  });

  it("preselects the only account of the currency when nothing is chosen", () => {
    expect(resolveAccountId(ACCOUNTS, "USD", null)).toBe("dollars");
  });

  it("chooses nothing when the currency has several accounts and none is chosen", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", null)).toBeNull();
  });

  it("drops a choice in another currency: the currency changed under it", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "dollars")).toBeNull();
    expect(resolveAccountId(ACCOUNTS, "USD", "galicia")).toBe("dollars");
  });

  it("drops an archived choice unless it is the record's own", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "old")).toBeNull();
    expect(resolveAccountId(ACCOUNTS, "ARS", "old", "old")).toBe("old");
  });

  it("chooses nothing in a currency without accounts", () => {
    expect(resolveAccountId(ACCOUNTS, "EUR", "galicia")).toBeNull();
  });

  it("drops an id that is not among the accounts at all", () => {
    expect(resolveAccountId(ACCOUNTS, "USD", "")).toBe("dollars");
  });
});

describe("excluding an account", () => {
  it("offers every account but the excluded one", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "ARS", null, "galicia"))).toEqual([
      "cash",
    ]);
  });

  it("keeps the record's own archived account next to an exclusion", () => {
    expect(ids(offeredAccounts(ACCOUNTS, "ARS", "old", "cash"))).toEqual([
      "galicia",
      "old",
    ]);
  });

  it("resolves to the only account left", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", null, null, "galicia")).toBe(
      "cash",
    );
  });

  it("drops a choice that is the excluded account", () => {
    expect(resolveAccountId(ACCOUNTS, "ARS", "galicia", null, "galicia")).toBe(
      "cash",
    );
  });
});
