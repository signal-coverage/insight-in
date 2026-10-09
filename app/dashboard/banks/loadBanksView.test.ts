import { beforeEach, describe, expect, it, vi } from "vitest";

const pageData = vi.hoisted(() => ({ loadBanksBoard: vi.fn() }));

vi.mock("@/core/banks/pageData", () => pageData);

import type { BoardBank } from "@/core/banks/types";

import { loadBanksView } from "./loadBanksView";

const BANKS: BoardBank[] = [
  {
    id: "bank_1",
    name: "Efectivo",
    kind: "ENTITY",
    archived: false,
    accounts: [
      {
        id: "acc_1",
        bankId: "bank_1",
        name: "Efectivo",
        currency: "ARS",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
    ],
  },
];

beforeEach(() => {
  pageData.loadBanksBoard.mockReset();
});

describe("loadBanksView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    pageData.loadBanksBoard.mockReturnValue(new Promise(() => {}));

    const view = loadBanksView("user_1");

    expect(Object.keys(view)).toEqual(["board"]);
    expect(view.board).toBeInstanceOf(Promise);
  });

  it("loads the board of the user once", async () => {
    pageData.loadBanksBoard.mockResolvedValue(BANKS);

    await loadBanksView("user_1").board;

    expect(pageData.loadBanksBoard).toHaveBeenCalledTimes(1);
    expect(pageData.loadBanksBoard).toHaveBeenCalledWith("user_1");
  });

  it("gives the banks as the loader read them", async () => {
    pageData.loadBanksBoard.mockResolvedValue(BANKS);

    await expect(loadBanksView("user_1").board).resolves.toEqual(BANKS);
  });

  it("rejects the board when the load fails, so it reaches the error boundary", async () => {
    pageData.loadBanksBoard.mockRejectedValue(new Error("database down"));

    await expect(loadBanksView("user_1").board).rejects.toThrow(
      "database down",
    );
  });
});
