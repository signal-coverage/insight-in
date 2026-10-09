import { describe, expect, it } from "vitest";

import {
  previousAccountBalances,
  sumAccountBalances,
  totalsByCurrency,
} from "./accounts";
import type { AccountFlow, AccountOpening } from "./types";

const flow = (
  accountId: string,
  kind: AccountFlow["kind"],
  amount: number,
  currency = "ARS",
): AccountFlow => ({ accountId, currency, kind, amount });

const opening = (
  month: string,
  ...amounts: [string, number, string?][]
): AccountOpening => ({
  month,
  amounts: amounts.map(([accountId, amount, currency = "ARS"]) => ({
    accountId,
    currency,
    amount,
  })),
});

describe("sumAccountBalances", () => {
  it("is the opening amount plus the settled incomes minus the settled expenses, per account", () => {
    expect(
      sumAccountBalances(opening("2026-06", ["bank", 50000]).amounts, [
        flow("bank", "income", 20000),
        flow("bank", "expense", 12000),
      ]),
    ).toEqual([{ accountId: "bank", currency: "ARS", balance: 58000 }]);
  });

  it("keeps two accounts of the same currency apart", () => {
    expect(
      sumAccountBalances(
        [],
        [flow("bank", "income", 1000), flow("cash", "expense", 300)],
      ),
    ).toEqual([
      { accountId: "bank", currency: "ARS", balance: 1000 },
      { accountId: "cash", currency: "ARS", balance: -300 },
    ]);
  });

  it("can be negative: it is shown, never blocked", () => {
    expect(
      sumAccountBalances([], [flow("cash", "expense", 999)])[0].balance,
    ).toBe(-999);
  });

  it("keeps an account that only has an opening amount, even at zero", () => {
    expect(
      sumAccountBalances(opening("2026-06", ["bank", 0]).amounts, []),
    ).toEqual([{ accountId: "bank", currency: "ARS", balance: 0 }]);
  });

  it("knows nothing of an account without opening amount nor movements", () => {
    expect(sumAccountBalances([], [])).toEqual([]);
  });
});

describe("previousAccountBalances", () => {
  const OPENING = opening("2026-06", ["bank", 50000], ["cash", 8000]);

  it("without an opening balance, is the net of everything settled before the month", () => {
    expect(
      previousAccountBalances("2026-09", null, [
        flow("bank", "income", 10000),
        flow("bank", "expense", 3500),
      ]),
    ).toEqual([{ accountId: "bank", currency: "ARS", balance: 6500 }]);
  });

  it("is nothing in a month before the opening month: no balance is invented", () => {
    expect(
      previousAccountBalances("2026-05", OPENING, [
        flow("bank", "income", 999),
      ]),
    ).toEqual([]);
  });

  it("is exactly the opening amounts in the opening month, whatever the flows say", () => {
    expect(
      previousAccountBalances("2026-06", OPENING, [
        flow("bank", "income", 999),
      ]),
    ).toEqual([
      { accountId: "bank", currency: "ARS", balance: 50000 },
      { accountId: "cash", currency: "ARS", balance: 8000 },
    ]);
  });

  it("adds the flows from the month right after the opening month on", () => {
    expect(
      previousAccountBalances("2026-07", OPENING, [
        flow("bank", "income", 20000),
        flow("cash", "expense", 3000),
      ]),
    ).toEqual([
      { accountId: "bank", currency: "ARS", balance: 70000 },
      { accountId: "cash", currency: "ARS", balance: 5000 },
    ]);
  });

  it("brings in an account that has entries but no opening amount", () => {
    expect(
      previousAccountBalances("2026-09", OPENING, [
        flow("new", "income", 300, "USD"),
      ]).find(({ accountId }) => accountId === "new"),
    ).toEqual({ accountId: "new", currency: "USD", balance: 300 });
  });
});

describe("totalsByCurrency", () => {
  it("adds the accounts of each currency and never mixes currencies", () => {
    expect(
      totalsByCurrency([
        { accountId: "bank", currency: "ARS", balance: 1000 },
        { accountId: "cash", currency: "ARS", balance: -300 },
        { accountId: "dollars", currency: "USD", balance: 50 },
      ]),
    ).toEqual([
      { currency: "ARS", amount: 700 },
      { currency: "USD", amount: 50 },
    ]);
  });

  it("is the sum of its accounts: moving money between two accounts of a currency changes the accounts, never the total", () => {
    const before = sumAccountBalances(
      opening("2026-06", ["bank", 1000]).amounts,
      [],
    );
    // The same 400 leaves one account and reaches another (stage 3 models this as a transfer, two
    // more flows of this very function).
    const after = sumAccountBalances(
      opening("2026-06", ["bank", 1000]).amounts,
      [flow("bank", "expense", 400), flow("cash", "income", 400)],
    );

    expect(after).not.toEqual(before);
    expect(totalsByCurrency(after)).toEqual(totalsByCurrency(before));
  });

  it("lists a crypto total after the legal tender ones, never added to them", () => {
    expect(
      totalsByCurrency([
        { accountId: "wallet", currency: "BTC", balance: 1500000 },
        { accountId: "dollars", currency: "USD", balance: 50 },
      ]),
    ).toEqual([
      { currency: "USD", amount: 50 },
      { currency: "BTC", amount: 1500000 },
    ]);
  });

  it("is empty for no accounts", () => {
    expect(totalsByCurrency([])).toEqual([]);
  });
});

describe("transfers as flows", () => {
  it("takes the amount out of the source and puts it into the destination", () => {
    expect(
      sumAccountBalances(
        [],
        [
          flow("acc_a", "income", 10000),
          flow("acc_a", "transferOut", 4000),
          flow("acc_b", "transferIn", 4000),
        ],
      ),
    ).toEqual([
      { accountId: "acc_a", currency: "ARS", balance: 6000 },
      { accountId: "acc_b", currency: "ARS", balance: 4000 },
    ]);
  });

  it("lets a transfer leave its source negative: it is shown in red, never blocked", () => {
    expect(
      sumAccountBalances(
        [],
        [
          flow("acc_a", "income", 1000),
          flow("acc_a", "transferOut", 2500),
          flow("acc_b", "transferIn", 2500),
        ],
      ),
    ).toEqual([
      { accountId: "acc_a", currency: "ARS", balance: -1500 },
      { accountId: "acc_b", currency: "ARS", balance: 2500 },
    ]);
  });

  it.each([[1], [4000], [10000], [999999999]])(
    "never changes the total of a currency: a transfer of %i leaves it as it was",
    (amount) => {
      const base = [
        flow("acc_a", "income", 10000),
        flow("acc_b", "expense", 2500),
        flow("acc_usd", "income", 777, "USD"),
      ];
      const before = totalsByCurrency(sumAccountBalances([], base));
      const after = totalsByCurrency(
        sumAccountBalances(
          [],
          [
            ...base,
            flow("acc_a", "transferOut", amount),
            flow("acc_b", "transferIn", amount),
          ],
        ),
      );

      expect(after).toEqual(before);
    },
  );

  it("is neutral in the previous balance of a month too", () => {
    const opened = opening("2026-06", ["acc_a", 5000], ["acc_b", 0]);
    const flows = [
      flow("acc_a", "transferOut", 2000),
      flow("acc_b", "transferIn", 2000),
    ];
    const previous = previousAccountBalances("2026-09", opened, flows);

    expect(previous).toEqual([
      { accountId: "acc_a", currency: "ARS", balance: 3000 },
      { accountId: "acc_b", currency: "ARS", balance: 2000 },
    ]);
    expect(totalsByCurrency(previous)).toEqual(
      totalsByCurrency(previousAccountBalances("2026-09", opened, [])),
    );
  });
});
