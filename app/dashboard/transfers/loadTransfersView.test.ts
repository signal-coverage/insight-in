import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({ loadTransfersPageData: vi.fn() }));

vi.mock("@/core/transfers/pageData", () => deps);

import { loadTransfersView } from "./loadTransfersView";

const TRANSFER = {
  id: "tr_1",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: null,
};
const ACCOUNTS = [
  {
    id: "acc_a",
    currency: "ARS",
    label: "Galicia · Caja de ahorro",
    archived: false,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  deps.loadTransfersPageData.mockResolvedValue({
    transfers: [TRANSFER],
    accounts: ACCOUNTS,
  });
});

describe("loadTransfersView", () => {
  it("returns promises and starts one load for the user and the month", () => {
    const view = loadTransfersView("user_1", "2026-10");

    expect(Object.keys(view).sort()).toEqual(["accounts", "table"]);
    expect(view.table).toBeInstanceOf(Promise);
    expect(view.accounts).toBeInstanceOf(Promise);
    expect(deps.loadTransfersPageData).toHaveBeenCalledTimes(1);
    expect(deps.loadTransfersPageData).toHaveBeenCalledWith(
      "user_1",
      "2026-10",
    );
  });

  it("gives the table the month's transfers as formatted rows", async () => {
    const { table } = loadTransfersView("user_1", "2026-10");
    const { rows } = await table;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "tr_1",
      amountDecimal: "1500.50",
      amountLabel: expect.stringMatching(/1\.500,50/),
    });
  });

  it("gives the accounts as they are", async () => {
    await expect(
      loadTransfersView("user_1", "2026-10").accounts,
    ).resolves.toEqual(ACCOUNTS);
  });
});
