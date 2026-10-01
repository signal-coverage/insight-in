import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ getMonthlySummary: vi.fn() }));

vi.mock("@/core/summary/service", () => service);

import { loadSummaryView } from "./loadSummaryView";

const ARS = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  current: 70000,
  target: 90000,
};

beforeEach(() => {
  service.getMonthlySummary.mockReset();
});

describe("loadSummaryView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    service.getMonthlySummary.mockReturnValue(new Promise(() => {}));

    const view = loadSummaryView("user_1", "2026-09");

    expect(view.summary).toBeInstanceOf(Promise);
  });

  it("asks for the user's own month", () => {
    service.getMonthlySummary.mockResolvedValue([]);

    loadSummaryView("user_1", "2026-09");

    expect(service.getMonthlySummary).toHaveBeenCalledWith("user_1", "2026-09");
  });

  it("hands the page the amounts already formatted in their currency", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);

    const [row] = await loadSummaryView("user_1", "2026-09").summary;

    expect(row.currency).toBe("ARS");
    expect(row.incomes.total).toMatch(/1\.400,00/);
    expect(row.expenses.pending).toMatch(/200,00/);
    expect(row.current).toMatch(/700,00/);
    expect(row.target).toMatch(/900,00/);
  });

  it("rejects when the load fails, so the page reaches its error boundary", async () => {
    service.getMonthlySummary.mockRejectedValue(new Error("database down"));

    await expect(loadSummaryView("user_1", "2026-09").summary).rejects.toThrow(
      "database down",
    );
  });
});
