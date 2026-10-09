import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openingBalanceInputSchema } from "./schema";

beforeEach(() => {
  // 2026-10-15 in Argentina, whatever the machine's zone.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const row = (accountId: string, currency: string, amount: string) => ({
  accountId,
  currency,
  amount,
});

const valid = {
  month: "2026-06",
  balances: [row("acc_bank", "ARS", "1500.50"), row("acc_cash", "ARS", "200")],
};

const issuePaths = (input: unknown): string[] => {
  const result = openingBalanceInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("openingBalanceInputSchema", () => {
  it("turns each account's amount into minor units of its currency", () => {
    expect(openingBalanceInputSchema.parse(valid)).toEqual({
      month: "2026-06",
      amounts: [
        { accountId: "acc_bank", currency: "ARS", amount: 150050 },
        { accountId: "acc_cash", currency: "ARS", amount: 20000 },
      ],
    });
  });

  it("respects the decimals of each currency", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_yen", "JPY", "1500")],
      }).amounts,
    ).toEqual([{ accountId: "acc_yen", currency: "JPY", amount: 1500 }]);
  });

  it("leaves out an amount that is empty or only spaces: it means no amount", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_bank", "ARS", "   ")],
      }).amounts,
    ).toEqual([]);
  });

  it("keeps an explicit zero: it is an amount, not a missing one", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_bank", "ARS", "0")],
      }).amounts,
    ).toEqual([{ accountId: "acc_bank", currency: "ARS", amount: 0 }]);
  });

  it("accepts no account at all: that clears the opening balance", () => {
    expect(
      openingBalanceInputSchema.parse({ month: "2026-06", balances: [] })
        .amounts,
    ).toEqual([]);
  });

  it("rejects a negative amount, a word and too many decimals, pointing at the field", () => {
    for (const amount of ["-5", "abc", "1.005"]) {
      expect(
        issuePaths({ ...valid, balances: [row("acc_bank", "ARS", amount)] }),
      ).toEqual(["balances.0.amount"]);
    }
  });

  it("says what is wrong with an amount, in Spanish", () => {
    const result = openingBalanceInputSchema.safeParse({
      ...valid,
      balances: [row("acc_bank", "ARS", "x")],
    });

    expect(result.error?.issues[0].message).toBe(
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    );
  });

  it.each(["2026-13", "2026-6", "1999-12", "2100-01", "", "junio"])(
    "rejects the month %j",
    (month) => {
      expect(issuePaths({ ...valid, month })).toEqual(["month"]);
    },
  );

  it("accepts the current month and a past one", () => {
    // The positive twin of the future-month checks below: these two must get through.
    for (const month of ["2026-10", "2026-09", "2023-01"]) {
      expect(issuePaths({ ...valid, month })).toEqual([]);
    }
  });

  it("rejects a month that has not started yet, in Spanish", () => {
    for (const month of ["2026-11", "2027-01", "2099-12"]) {
      expect(issuePaths({ ...valid, month })).toEqual(["month"]);
    }

    const result = openingBalanceInputSchema.safeParse({
      ...valid,
      month: "2026-11",
    });

    expect(result.error?.issues[0].message).toBe(
      "El mes inicial no puede ser posterior al actual. Elegí el mes actual o uno anterior.",
    );
  });

  it("decides the current month by the Argentine date, not the UTC one", () => {
    // 01:00 UTC of 1 November is still 31 October in Argentina (UTC-3).
    vi.setSystemTime(new Date("2026-11-01T01:00:00.000Z"));

    expect(issuePaths({ ...valid, month: "2026-11" })).toEqual(["month"]);
    expect(issuePaths({ ...valid, month: "2026-10" })).toEqual([]);

    // 03:00 UTC of 1 November is already 1 November in Argentina.
    vi.setSystemTime(new Date("2026-11-01T03:00:00.000Z"));

    expect(issuePaths({ ...valid, month: "2026-11" })).toEqual([]);
  });

  it("rejects a missing month, pointing at it", () => {
    expect(issuePaths({ balances: valid.balances })).toEqual(["month"]);
  });

  it("rejects a currency that is not supported", () => {
    expect(
      issuePaths({ ...valid, balances: [row("acc_bank", "XXX", "1")] }),
    ).toEqual(["balances.0.currency"]);
  });

  it("rejects the same account twice", () => {
    expect(
      issuePaths({
        ...valid,
        balances: [row("acc_bank", "ARS", "1"), row("acc_bank", "ARS", "2")],
      }),
    ).toEqual(["balances.1.accountId"]);
  });

  it("rejects a row without an account", () => {
    expect(issuePaths({ ...valid, balances: [row("  ", "ARS", "1")] })).toEqual(
      ["balances.0.accountId"],
    );
  });

  it("rejects more rows than any user has accounts", () => {
    expect(
      issuePaths({
        month: "2026-06",
        balances: Array.from({ length: 201 }, (_, index) =>
          row(`acc_${index}`, "ARS", "1"),
        ),
      }),
    ).toEqual(["balances"]);
  });

  it("rejects something that is not a list of balances", () => {
    expect(issuePaths({ ...valid, balances: "nope" })).toEqual(["balances"]);
    expect(issuePaths(null)).not.toEqual([]);
  });

  it("turns the amount of a crypto account into millionths", () => {
    expect(
      openingBalanceInputSchema.parse({
        month: "2026-06",
        balances: [row("acc_usdc", "USDC", "1.5")],
      }).amounts,
    ).toEqual([{ accountId: "acc_usdc", currency: "USDC", amount: 1500000 }]);
  });
});
