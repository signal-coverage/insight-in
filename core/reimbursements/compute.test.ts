import { describe, expect, it } from "vitest";

import { outstandingOf, pendingByCurrency, receivedById } from "./compute";

describe("outstandingOf", () => {
  it("is what is expected minus what was received", () => {
    expect(outstandingOf(1000000, 600000)).toBe(400000);
  });

  it("never goes below zero when more than expected came back", () => {
    expect(outstandingOf(1000000, 1500000)).toBe(0);
  });

  it("is everything when nothing came back", () => {
    expect(outstandingOf(1000000, 0)).toBe(1000000);
  });
});

describe("receivedById", () => {
  it("indexes the totals by expense", () => {
    const received = receivedById([
      { expenseId: "a", amount: 5 },
      { expenseId: "b", amount: 7 },
    ]);

    expect(received.get("a")).toBe(5);
    expect(received.get("b")).toBe(7);
    expect(received.get("c")).toBeUndefined();
  });
});

describe("pendingByCurrency", () => {
  const expenses = [
    { id: "a", currency: "ARS", expectedReimbursement: 1000000 },
    { id: "b", currency: "ARS", expectedReimbursement: 500000 },
    { id: "c", currency: "USD", expectedReimbursement: 20000 },
  ];

  it("adds up what is outstanding per currency, never across them", () => {
    expect(
      pendingByCurrency(expenses, [{ expenseId: "a", amount: 400000 }]),
    ).toEqual([
      { currency: "ARS", amount: 1100000 },
      { currency: "USD", amount: 20000 },
    ]);
  });

  it("counts a fully repaid expense as nothing and over-repayment never offsets another expense", () => {
    expect(
      pendingByCurrency(expenses, [
        { expenseId: "a", amount: 2500000 },
        { expenseId: "b", amount: 500000 },
      ]),
    ).toEqual([{ currency: "USD", amount: 20000 }]);
  });

  it("returns nothing when no expense expects a reimbursement", () => {
    expect(pendingByCurrency([], [])).toEqual([]);
  });

  it("sorts a crypto currency after the legal tender ones", () => {
    expect(
      pendingByCurrency(
        [
          { id: "x", currency: "BTC", expectedReimbursement: 1 },
          { id: "z", currency: "USD", expectedReimbursement: 1 },
        ],
        [],
      ).map(({ currency }) => currency),
    ).toEqual(["USD", "BTC"]);
  });

  it("sorts the currencies", () => {
    expect(
      pendingByCurrency(
        [
          { id: "z", currency: "USD", expectedReimbursement: 1 },
          { id: "y", currency: "ARS", expectedReimbursement: 1 },
        ],
        [],
      ).map(({ currency }) => currency),
    ).toEqual(["ARS", "USD"]);
  });
});
