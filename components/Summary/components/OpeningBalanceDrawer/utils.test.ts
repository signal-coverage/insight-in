import { describe, expect, it } from "vitest";

import { amountFieldName, monthOptions, toPayload } from "./utils";

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
  it("names a field after its row and medium, as the server reports its errors", () => {
    expect(amountFieldName(0, "digital")).toBe("balances.0.digital");
    expect(amountFieldName(2, "cash")).toBe("balances.2.cash");
  });
});

describe("toPayload", () => {
  const ROWS = [
    { currency: "ARS", digital: "", cash: "" },
    { currency: "USD", digital: "", cash: "" },
  ];

  const form = (entries: Record<string, string>) => {
    const formData = new FormData();

    Object.entries(entries).forEach(([key, value]) => formData.set(key, value));

    return formData;
  };

  it("sends the chosen month and each currency's two amounts as typed", () => {
    const payload = toPayload(
      form({
        month: "2026-06",
        "balances.0.digital": "1500.50",
        "balances.0.cash": "200",
        "balances.1.digital": "",
        "balances.1.cash": "50",
      }),
      ROWS,
    );

    expect(payload).toEqual({
      month: "2026-06",
      balances: [
        { currency: "ARS", digital: "1500.50", cash: "200" },
        { currency: "USD", digital: "", cash: "50" },
      ],
    });
  });

  it("sends an empty string for a field the form does not have", () => {
    const payload = toPayload(form({ month: "2026-06" }), ROWS);

    expect(payload.balances).toEqual([
      { currency: "ARS", digital: "", cash: "" },
      { currency: "USD", digital: "", cash: "" },
    ]);
  });
});
