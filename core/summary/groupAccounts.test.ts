import { describe, expect, it } from "vitest";

import { groupAccountBalances } from "./groupAccounts";
import type { AccountBalanceRow } from "./byAccount";

const row = (patch: Partial<AccountBalanceRow>): AccountBalanceRow => ({
  accountId: "acc_1",
  accountName: "Caja de ahorro",
  bankId: "bank_1",
  bankName: "Galicia",
  currency: "ARS",
  balance: 0,
  archived: false,
  ...patch,
});

describe("groupAccountBalances", () => {
  it("groups the accounts by currency and then by bank, keeping the order given, with the total of each currency", () => {
    const groups = groupAccountBalances([
      row({
        accountId: "a1",
        bankId: "b1",
        bankName: "Efectivo",
        accountName: "Efectivo",
        balance: 1000,
      }),
      row({
        accountId: "a2",
        bankId: "b2",
        bankName: "Galicia",
        accountName: "Caja",
        balance: 5000,
      }),
      row({
        accountId: "a3",
        bankId: "b2",
        bankName: "Galicia",
        accountName: "Dólares",
        currency: "USD",
        balance: 700,
      }),
      row({
        accountId: "a4",
        bankId: "b2",
        bankName: "Galicia",
        accountName: "Plazo",
        balance: 2500,
      }),
    ]);

    expect(groups).toEqual([
      {
        currency: "ARS",
        total: 8500,
        banks: [
          {
            bankId: "b1",
            bankName: "Efectivo",
            accounts: [expect.objectContaining({ accountId: "a1" })],
          },
          {
            bankId: "b2",
            bankName: "Galicia",
            accounts: [
              expect.objectContaining({ accountId: "a2" }),
              expect.objectContaining({ accountId: "a4" }),
            ],
          },
        ],
      },
      {
        currency: "USD",
        total: 700,
        banks: [
          {
            bankId: "b2",
            bankName: "Galicia",
            accounts: [expect.objectContaining({ accountId: "a3" })],
          },
        ],
      },
    ]);
  });

  it("never adds two currencies together", () => {
    const groups = groupAccountBalances([
      row({ accountId: "a1", balance: 100 }),
      row({ accountId: "a2", currency: "USD", balance: 100 }),
    ]);

    expect(groups.map(({ currency, total }) => [currency, total])).toEqual([
      ["ARS", 100],
      ["USD", 100],
    ]);
  });

  it("sorts the currencies A to Z whatever the order of the accounts", () => {
    const groups = groupAccountBalances([
      row({ accountId: "a1", currency: "USD" }),
      row({ accountId: "a2", currency: "ARS" }),
      row({ accountId: "a3", currency: "EUR" }),
    ]);

    expect(groups.map(({ currency }) => currency)).toEqual([
      "ARS",
      "EUR",
      "USD",
    ]);
  });

  it("shows the crypto currencies after the legal tender ones", () => {
    const groups = groupAccountBalances([
      row({ accountId: "a1", currency: "BTC", balance: 1500000 }),
      row({ accountId: "a2", currency: "USD", balance: 700 }),
      row({ accountId: "a3", currency: "ARS", balance: 1000 }),
    ]);

    expect(groups.map(({ currency }) => currency)).toEqual([
      "ARS",
      "USD",
      "BTC",
    ]);
    expect(groups[2].total).toBe(1500000);
  });

  it("keeps an active account at zero (a card with no money is still a card) and a negative one", () => {
    const [ars] = groupAccountBalances([
      row({ accountId: "a1", balance: 0 }),
      row({ accountId: "a2", balance: -300 }),
    ]);

    expect(ars.banks[0].accounts.map((a) => a.accountId)).toEqual(["a1", "a2"]);
    expect(ars.total).toBe(-300);
  });

  it("shows an archived account only while it still holds something, in either direction", () => {
    const [ars] = groupAccountBalances([
      row({ accountId: "gone", archived: true, balance: 0 }),
      row({ accountId: "rich", archived: true, balance: 900 }),
      row({ accountId: "debt", archived: true, balance: -50 }),
      row({ accountId: "live", balance: 10 }),
    ]);

    expect(ars.banks[0].accounts.map((a) => a.accountId)).toEqual([
      "rich",
      "debt",
      "live",
    ]);
  });

  it("drops a currency whose only accounts are archived and empty", () => {
    expect(
      groupAccountBalances([
        row({ archived: true, balance: 0, currency: "EUR" }),
      ]),
    ).toEqual([]);
  });

  it("is empty without accounts", () => {
    expect(groupAccountBalances([])).toEqual([]);
  });

  it("does not change the rows it is given", () => {
    const rows = [
      row({ accountId: "a1", currency: "USD" }),
      row({ accountId: "a2" }),
    ];
    const copy = rows.map((r) => ({ ...r }));

    groupAccountBalances(rows);

    expect(rows).toEqual(copy);
  });

  it("keeps a currency's total equal to the sum of its accounts when a transfer moves money between two of them", () => {
    const before = groupAccountBalances([
      row({ accountId: "a1", balance: 10000 }),
      row({ accountId: "a2", bankId: "b2", balance: 2000 }),
    ]);
    const after = groupAccountBalances([
      row({ accountId: "a1", balance: 6000 }),
      row({ accountId: "a2", bankId: "b2", balance: 6000 }),
    ]);

    expect(after[0].total).toBe(before[0].total);
  });
});
