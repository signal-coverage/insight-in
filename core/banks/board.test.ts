import { describe, expect, it } from "vitest";

import type { Account } from "@/core/accounts/types";

import {
  activeBanks,
  countActiveAccounts,
  filterBanks,
  normalizeSearch,
} from "./board";
import type { BankWithAccounts } from "./types";

const account = (
  id: string,
  bankId: string,
  name: string,
  patch: Partial<Account> = {},
): Account => ({
  id,
  bankId,
  name,
  currency: "ARS",
  archived: false,
  ...patch,
});

const BANKS: BankWithAccounts[] = [
  {
    id: "cash",
    name: "Efectivo",
    kind: "ENTITY",
    archived: false,
    accounts: [account("cash_ars", "cash", "Efectivo")],
  },
  {
    id: "galicia",
    name: "Banco Galicia",
    kind: "ENTITY",
    archived: false,
    accounts: [
      account("gal_sav", "galicia", "Caja de ahorro"),
      account("gal_usd", "galicia", "Cuenta en dólares", { currency: "USD" }),
      account("gal_old", "galicia", "Cuenta vieja", { archived: true }),
    ],
  },
  {
    id: "old",
    name: "Banco Viejo",
    kind: "ENTITY",
    archived: true,
    accounts: [account("old_acc", "old", "Caja cerrada", { archived: true })],
  },
];

const idsOf = (banks: BankWithAccounts[]) => banks.map((bank) => bank.id);
const accountIdsOf = (banks: BankWithAccounts[], bankId: string) =>
  banks.find((bank) => bank.id === bankId)?.accounts.map((item) => item.id);

describe("normalizeSearch", () => {
  it("trims, lowers the case and drops accents", () => {
    expect(normalizeSearch("  Cuenta en DÓLARES ")).toBe("cuenta en dolares");
  });
});

describe("filterBanks without a query", () => {
  it("hides archived banks and archived accounts", () => {
    const result = filterBanks(BANKS, { query: "", showArchived: false });

    expect(idsOf(result)).toEqual(["cash", "galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_sav", "gal_usd"]);
  });

  it("shows them all when archived items are shown, in the order they came", () => {
    const result = filterBanks(BANKS, { query: "", showArchived: true });

    expect(idsOf(result)).toEqual(["cash", "galicia", "old"]);
    expect(accountIdsOf(result, "galicia")).toEqual([
      "gal_sav",
      "gal_usd",
      "gal_old",
    ]);
  });

  it("treats a query of only spaces as no query", () => {
    expect(
      idsOf(filterBanks(BANKS, { query: "   ", showArchived: false })),
    ).toEqual(["cash", "galicia"]);
  });

  it("does not change the list it is given", () => {
    const before = JSON.stringify(BANKS);

    filterBanks(BANKS, { query: "galicia", showArchived: true });

    expect(JSON.stringify(BANKS)).toBe(before);
  });
});

describe("filterBanks with a query", () => {
  it("keeps a bank whose own name matches, with all its visible accounts", () => {
    const result = filterBanks(BANKS, {
      query: "galicia",
      showArchived: false,
    });

    expect(idsOf(result)).toEqual(["galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_sav", "gal_usd"]);
  });

  it("keeps a bank when only one of its accounts matches, showing just the matching accounts", () => {
    const result = filterBanks(BANKS, { query: "ahorro", showArchived: false });

    expect(idsOf(result)).toEqual(["galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_sav"]);
  });

  it("ignores case, accents and surrounding spaces", () => {
    const result = filterBanks(BANKS, {
      query: "  DOLARES ",
      showArchived: false,
    });

    expect(idsOf(result)).toEqual(["galicia"]);
    expect(accountIdsOf(result, "galicia")).toEqual(["gal_usd"]);
  });

  it("does not let an archived account that is hidden make its bank appear", () => {
    const hidden = filterBanks(BANKS, { query: "vieja", showArchived: false });

    expect(hidden).toEqual([]);
  });

  it("lets that archived account match once archived items are shown", () => {
    const shown = filterBanks(BANKS, { query: "vieja", showArchived: true });

    expect(idsOf(shown)).toEqual(["galicia"]);
    expect(accountIdsOf(shown, "galicia")).toEqual(["gal_old"]);
  });

  it("does not show an archived bank, found by its name or by its account, while archived items are hidden", () => {
    expect(filterBanks(BANKS, { query: "viejo", showArchived: false })).toEqual(
      [],
    );
    expect(
      filterBanks(BANKS, { query: "cerrada", showArchived: false }),
    ).toEqual([]);
  });

  it("finds an archived bank by its name or its account once archived items are shown", () => {
    expect(
      idsOf(filterBanks(BANKS, { query: "viejo", showArchived: true })),
    ).toEqual(["old"]);
    expect(
      idsOf(filterBanks(BANKS, { query: "cerrada", showArchived: true })),
    ).toEqual(["old"]);
  });

  it("matches names only, not currencies", () => {
    expect(filterBanks(BANKS, { query: "USD", showArchived: false })).toEqual(
      [],
    );
  });

  it("returns nothing when nothing matches", () => {
    expect(filterBanks(BANKS, { query: "zzz", showArchived: true })).toEqual(
      [],
    );
  });
});

describe("countActiveAccounts", () => {
  it("counts the accounts that are not archived", () => {
    expect(countActiveAccounts(BANKS[1])).toBe(2);
    expect(countActiveAccounts(BANKS[2])).toBe(0);
  });
});

describe("activeBanks", () => {
  it("lists the banks that are not archived as plain banks with their kind, without their accounts", () => {
    expect(activeBanks(BANKS)).toEqual([
      { id: "cash", name: "Efectivo", kind: "ENTITY", archived: false },
      { id: "galicia", name: "Banco Galicia", kind: "ENTITY", archived: false },
    ]);
  });

  it("keeps a wallet a wallet", () => {
    expect(
      activeBanks([{ ...BANKS[0], kind: "WALLET" }]).map(({ kind }) => kind),
    ).toEqual(["WALLET"]);
  });
});
