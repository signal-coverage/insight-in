import { describe, expect, it } from "vitest";

import {
  assertTransferAccount,
  giveBacks,
  isFutureDate,
  needsFundsCheck,
  netDeltas,
} from "./rules";
import type { GiveBack, TransferMove } from "./rules";
import { TransferAccountError } from "./errors";

describe("isFutureDate", () => {
  it("is true only for a day after today", () => {
    expect(isFutureDate("2026-10-07", "2026-10-06")).toBe(true);
    expect(isFutureDate("2026-10-06", "2026-10-06")).toBe(false);
    expect(isFutureDate("2026-10-05", "2026-10-06")).toBe(false);
    expect(isFutureDate("2027-01-01", "2026-12-31")).toBe(true);
  });
});

describe("needsFundsCheck", () => {
  const PREVIOUS = { fromAccountId: "acc_a", amount: 1000, date: "2026-10-01" };

  it("always checks a new transfer", () => {
    expect(needsFundsCheck(null, PREVIOUS)).toBe(true);
  });

  it("does not check an edit that asks nothing more of the source (notes, destination, same or lower amount)", () => {
    expect(needsFundsCheck(PREVIOUS, { ...PREVIOUS })).toBe(false);
    expect(needsFundsCheck(PREVIOUS, { ...PREVIOUS, amount: 400 })).toBe(false);
  });

  it.each([
    ["a higher amount", { amount: 1001 }],
    ["another source", { fromAccountId: "acc_b" }],
    ["an earlier day", { date: "2026-09-30" }],
    ["a later day", { date: "2026-10-02" }],
  ])("checks an edit with %s", (_label, patch) => {
    expect(needsFundsCheck(PREVIOUS, { ...PREVIOUS, ...patch })).toBe(true);
  });
});

describe("netDeltas", () => {
  const MOVE = { fromAccountId: "acc_a", toAccountId: "acc_b", amount: 5000 };

  it("a new transfer takes its amount out of the source and puts it into the destination", () => {
    expect(netDeltas([], [MOVE])).toEqual(
      new Map([
        ["acc_a", -5000],
        ["acc_b", 5000],
      ]),
    );
  });

  it("a bulk delete nets the same whatever the order of the transfers", () => {
    const first = {
      fromAccountId: "acc_a",
      toAccountId: "acc_b",
      amount: 5000,
    };
    const second = {
      fromAccountId: "acc_b",
      toAccountId: "acc_c",
      amount: 2000,
    };

    expect(netDeltas([second, first], [])).toEqual(
      netDeltas([first, second], []),
    );
    expect(netDeltas([first, second], [])).toEqual(
      new Map([
        ["acc_a", 5000],
        ["acc_b", -3000],
        ["acc_c", -2000],
      ]),
    );
  });

  it("removing a transfer reverses it: the source gets the amount back, the destination gives it back", () => {
    expect(netDeltas([MOVE], [])).toEqual(
      new Map([
        ["acc_a", 5000],
        ["acc_b", -5000],
      ]),
    );
  });

  it("an edit that changes nothing in the money (its notes) has no net change at all", () => {
    expect(netDeltas([MOVE], [{ ...MOVE }])).toEqual(new Map());
  });

  it("an edit that lowers the amount only gives back the difference, from the destination", () => {
    expect(netDeltas([MOVE], [{ ...MOVE, amount: 4000 }])).toEqual(
      new Map([
        ["acc_a", 1000],
        ["acc_b", -1000],
      ]),
    );
  });

  it("an edit that changes the destination takes the whole amount from the old one and gives it to the new one", () => {
    expect(netDeltas([MOVE], [{ ...MOVE, toAccountId: "acc_c" }])).toEqual(
      new Map([
        ["acc_b", -5000],
        ["acc_c", 5000],
      ]),
    );
  });

  it("adds up the transfers of one account (a bulk delete): what an account gets back and gives back cancels", () => {
    expect(
      netDeltas(
        [MOVE, { fromAccountId: "acc_b", toAccountId: "acc_c", amount: 2000 }],
        [],
      ),
    ).toEqual(
      new Map([
        ["acc_a", 5000],
        ["acc_b", -3000],
        ["acc_c", -2000],
      ]),
    );
  });

  it("leaves out an account whose changes cancel exactly", () => {
    const chain = [
      MOVE,
      { fromAccountId: "acc_b", toAccountId: "acc_c", amount: 5000 },
    ];

    expect(netDeltas(chain, []).has("acc_b")).toBe(false);
  });

  it("does not change the moves it is given", () => {
    const removed = [{ ...MOVE }];

    netDeltas(removed, []);

    expect(removed).toEqual([MOVE]);
  });
});

describe("giveBacks", () => {
  it("lists only the accounts that end with less, with how much, sorted by account id", () => {
    expect(
      giveBacks(
        new Map([
          ["acc_c", -2000],
          ["acc_a", 5000],
          ["acc_b", -3000],
        ]),
      ),
    ).toEqual([
      { accountId: "acc_b", amount: 3000 },
      { accountId: "acc_c", amount: 2000 },
    ]);
  });

  it("sorts by plain code-unit order, the order accounts are locked in (so an error names them like the locks), not by locale", () => {
    // localeCompare would put "a1" before "B1"; the lock order (ascending id) puts "B1" first.
    expect(
      giveBacks(
        new Map([
          ["a1", -1000],
          ["B1", -2000],
        ]),
      ).map(({ accountId }) => accountId),
    ).toEqual(["B1", "a1"]);
  });

  it("never lists an account that only gains (a delete's source) or has no change", () => {
    expect(giveBacks(new Map([["acc_a", 5000]]))).toEqual([]);
    expect(giveBacks(new Map())).toEqual([]);
  });

  it("leaves out the new source, which is checked on the transfer's date instead", () => {
    expect(
      giveBacks(
        new Map([
          ["acc_a", -8000],
          ["acc_b", -1000],
        ]),
        "acc_a",
      ),
    ).toEqual([{ accountId: "acc_b", amount: 1000 }]);
  });

  it.each([
    [
      "a delete",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [],
      [{ accountId: "b", amount: 5000 }],
    ],
    [
      "an edit lowering the amount",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "b", amount: 4000 }],
      [{ accountId: "b", amount: 1000 }],
    ],
    [
      "an edit changing the destination",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "c", amount: 5000 }],
      [{ accountId: "b", amount: 5000 }],
    ],
    [
      "an edit that only changes the notes",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [],
    ],
    [
      "an edit raising the amount (the destination only gains, the source is checked on its date)",
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [{ fromAccountId: "a", toAccountId: "b", amount: 7000 }],
      [],
    ],
    [
      "a new transfer",
      [],
      [{ fromAccountId: "a", toAccountId: "b", amount: 5000 }],
      [],
    ],
  ])(
    "%s",
    (
      _label,
      removed: TransferMove[],
      added: TransferMove[],
      expected: GiveBack[],
    ) => {
      const nextSource = added.length > 0 ? added[0].fromAccountId : null;

      expect(giveBacks(netDeltas(removed, added), nextSource)).toEqual(
        expected,
      );
    },
  );
});

describe("assertTransferAccount", () => {
  const active = { id: "acc_a", currency: "ARS", archivedAt: null };
  const archived = {
    id: "acc_old",
    currency: "ARS",
    archivedAt: new Date("2026-09-01T00:00:00.000Z"),
  };

  it("accepts an active account in the currency of the transfer", () => {
    expect(() =>
      assertTransferAccount("from", active, "ARS", null),
    ).not.toThrow();
  });

  it("treats an account that is not the user's as not found, naming the side", () => {
    expect(() => assertTransferAccount("to", null, "ARS", null)).toThrow(
      new TransferAccountError("to", "NOT_FOUND"),
    );
  });

  it("refuses an account in another currency", () => {
    expect(() =>
      assertTransferAccount(
        "from",
        { ...active, currency: "USD" },
        "ARS",
        null,
      ),
    ).toThrow(new TransferAccountError("from", "CURRENCY_MISMATCH"));
  });

  it("refuses an archived account, but an edit may keep the one the transfer already has", () => {
    expect(() => assertTransferAccount("to", archived, "ARS", null)).toThrow(
      new TransferAccountError("to", "ARCHIVED"),
    );
    expect(() =>
      assertTransferAccount("to", archived, "ARS", "acc_other"),
    ).toThrow(new TransferAccountError("to", "ARCHIVED"));
    expect(() =>
      assertTransferAccount("to", archived, "ARS", "acc_old"),
    ).not.toThrow();
  });

  it("checks the currency before the archive state, like assertUsableAccount", () => {
    expect(() =>
      assertTransferAccount(
        "from",
        { ...archived, currency: "USD" },
        "ARS",
        null,
      ),
    ).toThrow(new TransferAccountError("from", "CURRENCY_MISMATCH"));
  });
});
