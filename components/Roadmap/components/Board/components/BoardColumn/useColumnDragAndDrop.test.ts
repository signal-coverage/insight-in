// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real hook runs; this only lets the test see the options the column gave it, which is where
// the drops are handled (a real drag cannot be made in jsdom).
const spy = vi.hoisted(() => ({ useDragAndDrop: vi.fn() }));

vi.mock("react-aria-components", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-aria-components")>();

  spy.useDragAndDrop.mockImplementation(actual.useDragAndDrop);

  return { ...actual, useDragAndDrop: spy.useDragAndDrop };
});

import type { BoardItem } from "@/core/roadmap/types";

import { DRAG_TYPE } from "./consts";
import { useColumnDragAndDrop } from "./useColumnDragAndDrop";

const item = (id: string): BoardItem => ({
  id,
  title: `Item ${id}`,
  description: null,
  status: "TODO",
  position: 1,
  createdAt: "2026-10-04",
});

const ITEMS = [item("a"), item("b"), item("c")];

const drop = (id: string) => ({
  kind: "text" as const,
  types: new Set([DRAG_TYPE]),
  getText: async () => id,
});

const setup = () => {
  const onMove = vi.fn();

  renderHook(() =>
    useColumnDragAndDrop({ status: "TODO", items: ITEMS, onMove }),
  );

  // The options of the last render.
  const options = spy.useDragAndDrop.mock.calls.at(-1)?.[0];

  return { onMove, options };
};

beforeEach(() => {
  spy.useDragAndDrop.mockClear();
});

describe("useColumnDragAndDrop", () => {
  it("makes the cards draggable, carrying their ids, and only moves them", () => {
    const { options } = setup();

    expect(options.getItems(new Set(["b"]), ITEMS)).toEqual([
      { [DRAG_TYPE]: "b", "text/plain": "Item b" },
    ]);
    expect(options.getAllowedDropOperations()).toEqual(["move"]);
  });

  it("accepts only the drags of the board's own cards", () => {
    const { options } = setup();

    expect(options.acceptedDragTypes).toEqual([DRAG_TYPE]);
  });

  it("asks for a reorder inside the column, counting the places among the cards that stay", () => {
    const { onMove, options } = setup();

    options.onReorder({
      keys: new Set(["a"]),
      dropOperation: "move",
      target: { type: "item", key: "c", dropPosition: "after" },
    });

    expect(onMove).toHaveBeenCalledWith({ id: "a", status: "TODO", index: 2 });
  });

  it("asks for a card from another column to land between the cards of this one", async () => {
    const { onMove, options } = setup();

    await options.onInsert({
      items: [drop("x")],
      dropOperation: "move",
      target: { type: "item", key: "b", dropPosition: "before" },
    });

    expect(onMove).toHaveBeenCalledWith({ id: "x", status: "TODO", index: 1 });
  });

  it("asks for a card dropped on the column itself to go to its end", async () => {
    const { onMove, options } = setup();

    await options.onRootDrop({ items: [drop("x")], dropOperation: "move" });

    expect(onMove).toHaveBeenCalledWith({ id: "x", status: "TODO", index: 3 });
  });

  it("asks for nothing when what was dropped is not a card of the board", async () => {
    const { onMove, options } = setup();

    await options.onRootDrop({
      items: [
        {
          kind: "text",
          types: new Set(["text/plain"]),
          getText: async () => "hi",
        },
      ],
      dropOperation: "move",
    });
    await options.onInsert({
      items: [],
      dropOperation: "move",
      target: { type: "item", key: "b", dropPosition: "before" },
    });

    expect(onMove).not.toHaveBeenCalled();
  });
});
