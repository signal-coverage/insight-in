import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  listTransfers: vi.fn(),
  listAccountChoices: vi.fn(),
}));

vi.mock("./service", () => ({ listTransfers: deps.listTransfers }));
vi.mock("@/core/accounts/choices", () => ({
  listAccountChoices: deps.listAccountChoices,
}));

import { loadTransfersPageData } from "./pageData";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadTransfersPageData", () => {
  it("reads the month's transfers and every account of the user, together", async () => {
    const transfers = [{ id: "tr_1" }];
    const accounts = [{ id: "acc_a" }];

    deps.listTransfers.mockResolvedValue(transfers);
    deps.listAccountChoices.mockResolvedValue(accounts);

    await expect(loadTransfersPageData("user_1", "2026-10")).resolves.toEqual({
      transfers,
      accounts,
    });
    expect(deps.listTransfers).toHaveBeenCalledWith("user_1", "2026-10");
    expect(deps.listAccountChoices).toHaveBeenCalledWith("user_1");
  });

  it("starts both reads before waiting for either", () => {
    // The first read never settles: a sequential implementation would hang on it and never start the
    // second one.
    deps.listTransfers.mockReturnValue(new Promise(() => {}));
    deps.listAccountChoices.mockResolvedValue([]);

    void loadTransfersPageData("user_1", "2026-10");

    expect(deps.listTransfers).toHaveBeenCalledTimes(1);
    expect(deps.listAccountChoices).toHaveBeenCalledTimes(1);
  });
});
