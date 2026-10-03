import { describe, expect, it } from "vitest";

import type { CardCharge } from "./types";
import { committedTotal, fitOf, monthUsed, tierOf, usageOf } from "./usage";

// A charge on the card: an installment of a purchase or a purchase in one payment, it makes no
// difference to the usage.
const installment = (patch: Partial<CardCharge> = {}): CardCharge => ({
  amount: 10000,
  date: "2026-10-05",
  currency: "ARS",
  status: "PLANNED",
  ...patch,
});

const TOTAL_CARD = {
  currency: "ARS",
  limitMode: "TOTAL" as const,
  limitAmount: 100000,
};

const MONTHLY_CARD = {
  currency: "ARS",
  limitMode: "MONTHLY" as const,
  limitAmount: 30000,
};

describe("committedTotal", () => {
  it("adds up every pending installment", () => {
    expect(
      committedTotal(
        [
          installment({ amount: 10000, date: "2026-10-05" }),
          installment({ amount: 10001, date: "2026-11-05" }),
          installment({ amount: 5, date: "2027-03-05" }),
        ],
        "ARS",
      ),
    ).toBe(20006);
  });

  it("does not count what is already paid or covered by someone else", () => {
    expect(
      committedTotal(
        [
          installment({ amount: 10000 }),
          installment({ amount: 20000, status: "SETTLED" }),
          installment({ amount: 40000, status: "COVERED" }),
        ],
        "ARS",
      ),
    ).toBe(10000);
  });

  it("does not add amounts in another currency", () => {
    expect(
      committedTotal(
        [installment({ amount: 10000 }), installment({ currency: "USD" })],
        "ARS",
      ),
    ).toBe(10000);
  });

  it("is zero with nothing pending", () => {
    expect(committedTotal([], "ARS")).toBe(0);
  });
});

describe("monthUsed", () => {
  const ROWS = [
    installment({ amount: 10000, date: "2026-10-05" }),
    installment({ amount: 2000, date: "2026-10-25" }),
    installment({ amount: 7000, date: "2026-11-05" }),
    installment({ amount: 9000, date: "2026-10-06", status: "SETTLED" }),
    installment({ amount: 800, date: "2026-10-07", currency: "USD" }),
  ];

  it("adds up the pending and the paid charges dated in that month: a paid one was spent against the cap too", () => {
    expect(monthUsed(ROWS, "ARS", "2026-10")).toBe(21000);
    expect(monthUsed(ROWS, "ARS", "2026-11")).toBe(7000);
  });

  it("ignores charges somebody else covered and other currencies", () => {
    expect(
      monthUsed(
        [
          installment({ status: "COVERED" }),
          installment({ currency: "USD", amount: 1 }),
        ],
        "ARS",
        "2026-10",
      ),
    ).toBe(0);
  });

  it("is zero for a month with nothing in it", () => {
    expect(monthUsed(ROWS, "ARS", "2027-01")).toBe(0);
  });

  it("tells apart the same month of another year", () => {
    expect(
      monthUsed([installment({ date: "2027-10-05" })], "ARS", "2026-10"),
    ).toBe(0);
  });
});

describe("tierOf", () => {
  it("is available up to 80% of the cap, 80% included", () => {
    expect(tierOf(0, 100000)).toBe("available");
    expect(tierOf(79999, 100000)).toBe("available");
    expect(tierOf(80000, 100000)).toBe("available");
  });

  it("is near above 80% and up to the cap, the cap included", () => {
    expect(tierOf(80001, 100000)).toBe("near");
    expect(tierOf(100000, 100000)).toBe("near");
  });

  it("is exceeded above the cap", () => {
    expect(tierOf(100001, 100000)).toBe("exceeded");
  });

  it("compares exactly, even with amounts too big for a safe product", () => {
    const limit = Number.MAX_SAFE_INTEGER;

    expect(tierOf(limit, limit)).toBe("near");
    expect(tierOf(limit - 1, limit)).toBe("near");
    // 80% of the limit is 7205759403792792.8: the floor is available, the next integer is near.
    expect(tierOf(7205759403792792, limit)).toBe("available");
    expect(tierOf(7205759403792793, limit)).toBe("near");
  });
});

describe("usageOf", () => {
  const ROWS = [
    installment({ amount: 10000, date: "2026-10-05" }),
    installment({ amount: 15000, date: "2026-10-28" }),
    installment({ amount: 30000, date: "2026-11-05" }),
    installment({ amount: 5000, date: "2026-12-05", status: "SETTLED" }),
    installment({ amount: 999, date: "2026-10-05", currency: "USD" }),
  ];

  it("uses the whole committed total against a TOTAL cap, wherever it falls", () => {
    expect(usageOf(TOTAL_CARD, ROWS, "2026-10")).toEqual({
      committedTotal: 55000,
      monthUsed: 25000,
      used: 55000,
      available: 45000,
      tier: "available",
    });
  });

  it("uses only the current month against a MONTHLY cap", () => {
    expect(usageOf(MONTHLY_CARD, ROWS, "2026-10")).toEqual({
      committedTotal: 55000,
      monthUsed: 25000,
      used: 25000,
      available: 5000,
      tier: "near",
    });
  });

  it("moves with the month: another month of the same card uses another amount", () => {
    expect(usageOf(MONTHLY_CARD, ROWS, "2026-11")).toMatchObject({
      used: 30000,
      available: 0,
      tier: "near",
    });
    expect(usageOf(MONTHLY_CARD, ROWS, "2026-09")).toMatchObject({
      used: 0,
      available: 30000,
      tier: "available",
    });
  });

  it("counts a paid charge of the month against a MONTHLY cap, but not against a TOTAL one", () => {
    const paid = [
      installment({ amount: 20000, date: "2026-10-03", status: "SETTLED" }),
      installment({ amount: 5000, date: "2026-10-20" }),
    ];

    expect(usageOf(MONTHLY_CARD, paid, "2026-10")).toMatchObject({
      committedTotal: 5000,
      monthUsed: 25000,
      used: 25000,
    });
    expect(usageOf(TOTAL_CARD, paid, "2026-10")).toMatchObject({
      committedTotal: 5000,
      monthUsed: 25000,
      used: 5000,
    });
  });

  it("counts a purchase in one payment like an installment", () => {
    const single = [installment({ amount: 12000, date: "2026-10-15" })];

    expect(usageOf(MONTHLY_CARD, single, "2026-10").used).toBe(12000);
    expect(usageOf(TOTAL_CARD, single, "2026-10").used).toBe(12000);
  });

  it("never counts what somebody else covered, in either mode", () => {
    const covered = [installment({ amount: 90000, status: "COVERED" })];

    expect(usageOf(MONTHLY_CARD, covered, "2026-10").used).toBe(0);
    expect(usageOf(TOTAL_CARD, covered, "2026-10").used).toBe(0);
  });

  it("lets the available amount go negative, and calls the card exceeded", () => {
    expect(
      usageOf({ ...MONTHLY_CARD, limitAmount: 20000 }, ROWS, "2026-10"),
    ).toMatchObject({ used: 25000, available: -5000, tier: "exceeded" });
  });

  it("has all of the cap available when nothing is pending", () => {
    expect(usageOf(TOTAL_CARD, [], "2026-10")).toEqual({
      committedTotal: 0,
      monthUsed: 0,
      used: 0,
      available: 100000,
      tier: "available",
    });
  });

  it("ignores everything that is paid or in another currency", () => {
    expect(
      usageOf(
        TOTAL_CARD,
        [
          installment({ amount: 90000, status: "SETTLED" }),
          installment({ amount: 90000, status: "COVERED" }),
          installment({ amount: 90000, currency: "USD" }),
        ],
        "2026-10",
      ),
    ).toMatchObject({ used: 0, available: 100000, tier: "available" });
  });
});

describe("fitOf", () => {
  const purchase = (
    installments: { month: string; amount: number }[],
    currency = "ARS",
  ) => ({
    currency,
    totalAmount: installments.reduce((sum, { amount }) => sum + amount, 0),
    installments,
  });

  describe("on a TOTAL card", () => {
    const ROWS = [
      installment({ amount: 40000, date: "2026-10-05" }),
      installment({ amount: 20000, date: "2026-11-05" }),
    ];

    it("fits when the whole purchase is within what is still available, with the margin", () => {
      expect(
        fitOf(
          TOTAL_CARD,
          ROWS,
          purchase([
            { month: "2026-12", amount: 10000 },
            { month: "2027-01", amount: 10000 },
          ]),
        ),
      ).toEqual({ fits: true, margin: 20000 });
    });

    it("fits exactly when it takes everything that is left", () => {
      expect(
        fitOf(
          TOTAL_CARD,
          ROWS,
          purchase([{ month: "2026-12", amount: 40000 }]),
        ),
      ).toEqual({ fits: true, margin: 0 });
    });

    it("does not fit by one unit too much, and says how much it exceeds", () => {
      expect(
        fitOf(
          TOTAL_CARD,
          ROWS,
          purchase([{ month: "2026-12", amount: 40001 }]),
        ),
      ).toEqual({ fits: false, reason: "limit", excess: 1 });
    });

    it("counts only what is still pending, so paying installments makes room", () => {
      const paid = [
        installment({ amount: 40000, status: "SETTLED" }),
        installment({ amount: 20000, status: "COVERED" }),
      ];

      expect(
        fitOf(
          TOTAL_CARD,
          paid,
          purchase([{ month: "2026-12", amount: 100000 }]),
        ),
      ).toEqual({ fits: true, margin: 0 });
    });

    it("does not look at the months, only at the total", () => {
      const heavy = purchase([
        { month: "2026-10", amount: 35000 },
        { month: "2026-11", amount: 5000 },
      ]);

      expect(fitOf(TOTAL_CARD, ROWS, heavy)).toEqual({
        fits: true,
        margin: 0,
      });
    });
  });

  describe("on a MONTHLY card", () => {
    const ROWS = [
      installment({ amount: 20000, date: "2026-10-05" }),
      installment({ amount: 5000, date: "2026-11-05" }),
    ];

    it("fits when every month it touches stays within the cap, with the smallest margin", () => {
      expect(
        fitOf(
          MONTHLY_CARD,
          ROWS,
          purchase([
            { month: "2026-10", amount: 4000 },
            { month: "2026-11", amount: 4000 },
            { month: "2026-12", amount: 4000 },
          ]),
        ),
      ).toEqual({ fits: true, margin: 6000, month: "2026-10" });
    });

    it("fits exactly when a month ends right at the cap", () => {
      expect(
        fitOf(
          MONTHLY_CARD,
          ROWS,
          purchase([{ month: "2026-10", amount: 10000 }]),
        ),
      ).toEqual({ fits: true, margin: 0, month: "2026-10" });
    });

    it("does not fit when one month goes over, even if the others have room", () => {
      expect(
        fitOf(
          MONTHLY_CARD,
          ROWS,
          purchase([
            { month: "2026-10", amount: 10001 },
            { month: "2026-11", amount: 1 },
          ]),
        ),
      ).toEqual({ fits: false, reason: "limit", excess: 1, month: "2026-10" });
    });

    it("reports the month with the most excess when several go over", () => {
      expect(
        fitOf(
          MONTHLY_CARD,
          ROWS,
          purchase([
            { month: "2026-10", amount: 10500 },
            { month: "2026-11", amount: 30000 },
          ]),
        ),
      ).toEqual({
        fits: false,
        reason: "limit",
        excess: 5000,
        month: "2026-11",
      });
    });

    it("adds the installments of the purchase that fall in the same month", () => {
      expect(
        fitOf(
          MONTHLY_CARD,
          [],
          purchase([
            { month: "2026-10", amount: 20000 },
            { month: "2026-10", amount: 10001 },
          ]),
        ),
      ).toEqual({ fits: false, reason: "limit", excess: 1, month: "2026-10" });
    });

    it("does not look at the total, so a long purchase with a small installment fits", () => {
      const months = Array.from({ length: 12 }, (_, index) => ({
        month: `2027-${String(index + 1).padStart(2, "0")}`,
        amount: 25000,
      }));

      expect(fitOf(MONTHLY_CARD, ROWS, purchase(months))).toEqual({
        fits: true,
        margin: 5000,
        month: "2027-01",
      });
    });

    it("counts what the card already has in a month, pending or paid, but not what somebody else covered", () => {
      const rows = [
        installment({ amount: 20000, date: "2026-10-03", status: "SETTLED" }),
        installment({ amount: 9999, date: "2026-10-20" }),
        installment({ amount: 50000, date: "2026-10-21", status: "COVERED" }),
      ];

      expect(
        fitOf(MONTHLY_CARD, rows, purchase([{ month: "2026-10", amount: 1 }])),
      ).toEqual({ fits: true, margin: 0, month: "2026-10" });
      expect(
        fitOf(MONTHLY_CARD, rows, purchase([{ month: "2026-10", amount: 2 }])),
      ).toEqual({ fits: false, reason: "limit", excess: 1, month: "2026-10" });
    });

    it("looks at the usage of every month the purchase touches, not only the current one", () => {
      const rows = [
        installment({ amount: 29000, date: "2027-02-05" }),
        installment({ amount: 1000, date: "2026-10-05" }),
      ];

      expect(
        fitOf(
          MONTHLY_CARD,
          rows,
          purchase([
            { month: "2026-10", amount: 5000 },
            { month: "2027-02", amount: 2000 },
          ]),
        ),
      ).toEqual({
        fits: false,
        reason: "limit",
        excess: 1000,
        month: "2027-02",
      });
    });

    it("counts a purchase in one payment like an installment", () => {
      const single = [installment({ amount: 28000, date: "2026-10-15" })];

      expect(
        fitOf(
          MONTHLY_CARD,
          single,
          purchase([{ month: "2026-10", amount: 2500 }]),
        ),
      ).toEqual({
        fits: false,
        reason: "limit",
        excess: 500,
        month: "2026-10",
      });
    });
  });

  it("never fits a purchase in another currency than the card's", () => {
    expect(
      fitOf(TOTAL_CARD, [], purchase([{ month: "2026-10", amount: 1 }], "USD")),
    ).toEqual({ fits: false, reason: "currency" });
    expect(
      fitOf(
        MONTHLY_CARD,
        [],
        purchase([{ month: "2026-10", amount: 1 }], "USD"),
      ),
    ).toEqual({ fits: false, reason: "currency" });
  });

  it("does not mix in the pending installments of another currency", () => {
    expect(
      fitOf(
        TOTAL_CARD,
        [installment({ amount: 99999, currency: "USD" })],
        purchase([{ month: "2026-10", amount: 100000 }]),
      ),
    ).toEqual({ fits: true, margin: 0 });
  });
});
