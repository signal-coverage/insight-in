import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ getConversions: vi.fn() }));

vi.mock("@/core/conversions/service", () => service);

import { loadConversionsView } from "./loadConversionsView";

const EMPTY = { incomes: [], expenses: [], evolution: [] };

beforeEach(() => {
  service.getConversions.mockReset();
});

describe("loadConversionsView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    service.getConversions.mockReturnValue(new Promise(() => {}));

    const view = loadConversionsView("user_1", "2026-09");

    expect(view.conversions).toBeInstanceOf(Promise);
  });

  it("asks for the user's own month", async () => {
    service.getConversions.mockResolvedValue(EMPTY);

    await loadConversionsView("user_1", "2026-09").conversions;

    expect(service.getConversions).toHaveBeenCalledTimes(1);
    expect(service.getConversions).toHaveBeenCalledWith("user_1", "2026-09");
  });

  it("hands the page the figures already formatted in their own currencies", async () => {
    service.getConversions.mockResolvedValue({
      ...EMPTY,
      incomes: [
        {
          side: "income",
          originCurrency: "USDC",
          netCurrency: "ARS",
          count: 1,
          totalOrigin: 1_000_000_000,
          totalNet: 120_000_000,
          averageRate: 1200,
          best: { rate: 1200, date: "2026-09-05" },
          worst: { rate: 1200, date: "2026-09-05" },
          last: { rate: 1200, date: "2026-09-05" },
          items: [],
        },
      ],
    });

    const { incomes } = await loadConversionsView("user_1", "2026-09")
      .conversions;

    expect(incomes[0].id).toBe("USDC → ARS");
    expect(incomes[0].totalOrigin).toBe("1.000,00 USDC");
    expect(incomes[0].totalNet).toMatch(/1\.200\.000,00/);
  });

  it("rejects when the load fails, so the page reaches its error boundary", async () => {
    service.getConversions.mockRejectedValue(new Error("database down"));

    await expect(
      loadConversionsView("user_1", "2026-09").conversions,
    ).rejects.toThrow("database down");
  });
});
