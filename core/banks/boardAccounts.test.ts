import { describe, expect, it } from "vitest";

import { toBoardBanks } from "./boardAccounts";

const BANKS = [
  {
    id: "bank_1",
    name: "Banco Galicia",
    kind: "ENTITY" as const,
    archived: false,
    accounts: [
      {
        id: "acc_1",
        bankId: "bank_1",
        name: "Caja de ahorro",
        currency: "ARS",
        archived: false,
      },
      {
        id: "acc_2",
        bankId: "bank_1",
        name: "Dólares",
        currency: "USD",
        archived: false,
      },
      {
        id: "acc_3",
        bankId: "bank_1",
        name: "Nueva",
        currency: "ARS",
        archived: false,
      },
    ],
  },
];

describe("toBoardBanks", () => {
  const [bank] = toBoardBanks(
    BANKS,
    [
      { accountId: "acc_1", currency: "ARS", balance: 150000 },
      { accountId: "acc_2", currency: "USD", balance: -2550 },
    ],
    new Set(["acc_1", "acc_2"]),
  );

  it("gives every account its balance, formatted in the account's currency", () => {
    expect(bank.accounts[0].balance).toBe(150000);
    expect(bank.accounts[0].balanceLabel).toMatch(/1\.500,00/);
    expect(bank.accounts[1].balanceLabel).toMatch(/US\$/);
  });

  it("keeps a negative balance negative: it is shown, never hidden", () => {
    expect(bank.accounts[1].balance).toBe(-2550);
    expect(bank.accounts[1].balanceLabel).toMatch(/-/);
  });

  it("gives an account without movements a balance of zero", () => {
    expect(bank.accounts[2].balance).toBe(0);
    expect(bank.accounts[2].balanceLabel).toMatch(/0,00/);
  });

  it("says which accounts have movements", () => {
    expect(bank.accounts.map((account) => account.hasMovements)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("keeps everything else of the bank and its accounts", () => {
    expect(bank).toMatchObject({
      id: "bank_1",
      name: "Banco Galicia",
      kind: "ENTITY",
      archived: false,
    });
    expect(bank.accounts[0]).toMatchObject(BANKS[0].accounts[0]);
  });
});

describe("toBoardBanks with a crypto account", () => {
  const [wallet] = toBoardBanks(
    [
      {
        id: "bank_mp",
        name: "Mercado Pago",
        kind: "WALLET",
        archived: false,
        accounts: [
          {
            id: "acc_usdc",
            bankId: "bank_mp",
            name: "USDC",
            currency: "USDC",
            archived: false,
          },
        ],
      },
    ],
    [{ accountId: "acc_usdc", currency: "USDC", balance: -1500000 }],
    new Set(["acc_usdc"]),
  );

  it("formats its balance as a number and its code, never as an ISO currency", () => {
    expect(wallet.accounts[0].balance).toBe(-1500000);
    expect(wallet.accounts[0].balanceLabel).toBe("-1,50 USDC");
  });
});
