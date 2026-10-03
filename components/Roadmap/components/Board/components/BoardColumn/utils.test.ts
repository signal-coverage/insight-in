import { describe, expect, it } from "vitest";

import type { BoardItem } from "@/core/roadmap/types";

import { DRAG_TYPE } from "./consts";
import { dragItemsFor, droppedIds, dropRequest } from "./utils";

const item = (id: string, title: string): BoardItem => ({
  id,
  title,
  description: null,
  status: "IDEA",
  position: 1,
  createdAt: "2026-10-04",
});

const textDrop = (types: string[], text: string) => ({
  kind: "text" as const,
  types: new Set(types),
  getText: async () => text,
});

describe("dragItemsFor", () => {
  it("carries the id of the card under the type the columns accept, and its title as plain text", () => {
    expect(
      dragItemsFor(new Set(["a"]), [
        item("a", "Modo oscuro"),
        item("b", "Otra"),
      ]),
    ).toEqual([{ [DRAG_TYPE]: "a", "text/plain": "Modo oscuro" }]);
  });

  it("falls back to an empty text for a key that is not in the column", () => {
    expect(dragItemsFor(new Set(["zzz"]), [item("a", "A")])).toEqual([
      { [DRAG_TYPE]: "zzz", "text/plain": "" },
    ]);
  });
});

describe("droppedIds", () => {
  it("reads the id of every dropped card", async () => {
    await expect(
      droppedIds([textDrop([DRAG_TYPE], "a"), textDrop([DRAG_TYPE], "b")]),
    ).resolves.toEqual(["a", "b"]);
  });

  it("ignores text that is not a card of the board, and files", async () => {
    await expect(
      droppedIds([
        textDrop(["text/plain"], "hello"),
        {
          kind: "file" as const,
          type: "image/png",
          name: "a.png",
          getFile: async () => new File([], "a.png"),
          getText: async () => "",
        },
      ]),
    ).resolves.toEqual([]);
  });
});

describe("dropRequest", () => {
  const IDS = ["a", "b", "c"];

  it("asks for the place right before the card it was dropped before", () => {
    expect(
      dropRequest("IDEA", IDS, "x", { key: "b", dropPosition: "before" }),
    ).toEqual({ id: "x", status: "IDEA", index: 1 });
  });

  it("asks for the place right after the card it was dropped after", () => {
    expect(
      dropRequest("TODO", IDS, "x", { key: "b", dropPosition: "after" }),
    ).toEqual({ id: "x", status: "TODO", index: 2 });
  });

  it("does not count the moving card when it is reordered inside its own column", () => {
    expect(
      dropRequest("IDEA", IDS, "a", { key: "c", dropPosition: "after" }),
    ).toEqual({ id: "a", status: "IDEA", index: 2 });
  });

  it("goes to the end of the column with no target at all", () => {
    expect(dropRequest("DONE", IDS, "x", null)).toEqual({
      id: "x",
      status: "DONE",
      index: 3,
    });
    expect(dropRequest("DONE", IDS, "a", null).index).toBe(2);
  });
});
