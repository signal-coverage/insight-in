import { describe, expect, it } from "vitest";

import {
  amountFieldName,
  monthOptions,
  openingRowLabel,
  toPayload,
} from "./utils";

describe("monthOptions", () => {
  it("runs from the month in course back 36 months, most recent first", () => {
    const options = monthOptions("2026-10", null);

    expect(options).toHaveLength(37);
    expect(options[0].value).toBe("2026-10");
    expect(options[36].value).toBe("2023-10");
  });

  it("labels each month the way the rest of the summary does", () => {
    const [current, previous] = monthOptions("2026-10", null);

    expect(current.label).toBe("Octubre de 2026");
    expect(previous.label).toBe("Septiembre de 2026");
  });

  it("crosses the year without skipping or repeating a month", () => {
    const values = monthOptions("2026-02", null).map((option) => option.value);

    expect(values.slice(0, 4)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ]);
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps a saved month that is older than the range, so it can still be shown", () => {
    const options = monthOptions("2026-10", "2020-03");

    expect(options.map((option) => option.value)).toContain("2020-03");
    expect(options[options.length - 1].value).toBe("2020-03");
    expect(options).toHaveLength(38);
  });

  it("does not repeat a saved month that is already in the range", () => {
    expect(monthOptions("2026-10", "2026-06")).toHaveLength(37);
  });
});

describe("amountFieldName", () => {
  it("names a field after its row, as the server reports its errors", () => {
    expect(amountFieldName(0)).toBe("balances.0.amount");
    expect(amountFieldName(4)).toBe("balances.4.amount");
  });
});

describe("openingRowLabel", () => {
  it("names the account with its currency", () => {
    expect(openingRowLabel("Caja de ahorro", "ARS", false)).toBe(
      "Caja de ahorro (ARS)",
    );
  });

  it("says when the account is archived", () => {
    expect(openingRowLabel("Vieja", "USD", true)).toBe(
      "Vieja (USD) · archivada",
    );
  });
});

describe("toPayload", () => {
  const GROUPS = [
    {
      bankId: "bank_galicia",
      bankName: "Banco Galicia",
      rows: [
        {
          index: 0,
          accountId: "acc_bank",
          currency: "ARS",
          label: "Caja de ahorro (ARS)",
          amount: "",
        },
        {
          index: 1,
          accountId: "acc_usd",
          currency: "USD",
          label: "Dólares (USD)",
          amount: "",
        },
      ],
    },
    {
      bankId: "bank_cash",
      bankName: "Efectivo",
      rows: [
        {
          index: 2,
          accountId: "acc_cash",
          currency: "ARS",
          label: "Efectivo (ARS)",
          amount: "",
        },
      ],
    },
  ];

  const form = (entries: Record<string, string>) => {
    const formData = new FormData();

    Object.entries(entries).forEach(([key, value]) => formData.set(key, value));

    return formData;
  };

  it("sends the month and one row per account, every bank together, as typed", () => {
    expect(
      toPayload(
        form({
          month: "2026-06",
          "balances.0.amount": "1500.50",
          "balances.2.amount": "200",
        }),
        GROUPS,
      ),
    ).toEqual({
      month: "2026-06",
      balances: [
        { accountId: "acc_bank", currency: "ARS", amount: "1500.50" },
        { accountId: "acc_usd", currency: "USD", amount: "" },
        { accountId: "acc_cash", currency: "ARS", amount: "200" },
      ],
    });
  });

  it("sends the rows in the order of their index, so the server's position is the input's name", () => {
    // Two banks whose accounts interleave: the groups hold indexes [0, 2] and [1].
    const interleaved = [
      {
        bankId: "bank_a",
        bankName: "Banco A",
        rows: [
          { ...GROUPS[0].rows[0], index: 0, accountId: "acc_a1" },
          { ...GROUPS[0].rows[0], index: 2, accountId: "acc_a2" },
        ],
      },
      {
        bankId: "bank_b",
        bankName: "Banco B",
        rows: [{ ...GROUPS[0].rows[0], index: 1, accountId: "acc_b1" }],
      },
    ];
    const { balances } = toPayload(
      form({
        "balances.0.amount": "10",
        "balances.1.amount": "20",
        "balances.2.amount": "30",
      }),
      interleaved,
    );

    expect(balances.map(({ accountId }) => accountId)).toEqual([
      "acc_a1",
      "acc_b1",
      "acc_a2",
    ]);
    // Position i of the payload is the row that the input `balances.<i>.amount` belongs to.
    balances.forEach(({ amount }, position) => {
      expect(amount).toBe(String((position + 1) * 10));
    });
  });
});
