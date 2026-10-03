import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ listBoard: vi.fn() }));

vi.mock("@/core/roadmap/service", () => service);

import type { BoardColumns } from "@/core/roadmap/types";

import { loadRoadmapView } from "./loadRoadmapView";

const BOARD: BoardColumns = {
  IDEA: [
    {
      id: "item_1",
      title: "Modo oscuro",
      description: null,
      status: "IDEA",
      position: 1024,
      createdAt: "2026-10-04",
    },
  ],
  TODO: [],
  DONE: [],
  DEPLOYED: [],
};

beforeEach(() => {
  service.listBoard.mockReset();
});

describe("loadRoadmapView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    service.listBoard.mockReturnValue(new Promise(() => {}));

    const view = loadRoadmapView("user_1");

    expect(Object.keys(view)).toEqual(["board"]);
    expect(view.board).toBeInstanceOf(Promise);
  });

  it("loads the board of the user once", async () => {
    service.listBoard.mockResolvedValue(BOARD);

    await loadRoadmapView("user_1").board;

    expect(service.listBoard).toHaveBeenCalledTimes(1);
    expect(service.listBoard).toHaveBeenCalledWith("user_1");
  });

  it("gives the columns as the service read them", async () => {
    service.listBoard.mockResolvedValue(BOARD);

    await expect(loadRoadmapView("user_1").board).resolves.toEqual(BOARD);
  });

  it("rejects the board when the load fails, so it reaches the error boundary", async () => {
    service.listBoard.mockRejectedValue(new Error("database down"));

    await expect(loadRoadmapView("user_1").board).rejects.toThrow(
      "database down",
    );
  });
});
