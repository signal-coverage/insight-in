import { describe, expect, it } from "vitest";

import {
  emptyColumns,
  groupByStatus,
  moveInColumns,
  placeIndex,
} from "./board";
import type { BoardColumns, BoardItem } from "./types";

const item = (
  id: string,
  status: BoardItem["status"],
  position: number,
): BoardItem => ({
  id,
  title: `Item ${id}`,
  description: null,
  status,
  position,
  createdAt: "2026-10-01",
});

const ids = (items: BoardItem[]) => items.map((entry) => entry.id);

const BOARD: BoardColumns = {
  IDEA: [item("a", "IDEA", 1), item("b", "IDEA", 2), item("c", "IDEA", 3)],
  TODO: [item("d", "TODO", 1)],
  DONE: [],
  DEPLOYED: [item("e", "DEPLOYED", 1)],
};

describe("emptyColumns", () => {
  it("has the four columns, in order, with no cards", () => {
    expect(Object.keys(emptyColumns())).toEqual([
      "IDEA",
      "TODO",
      "DONE",
      "DEPLOYED",
    ]);
    expect(Object.values(emptyColumns()).every((c) => c.length === 0)).toBe(
      true,
    );
  });

  it("gives a new object every time", () => {
    expect(emptyColumns()).not.toBe(emptyColumns());
  });
});

describe("groupByStatus", () => {
  it("keeps the order of the cards inside each column", () => {
    const columns = groupByStatus([
      item("a", "TODO", 1),
      item("b", "IDEA", 2),
      item("c", "TODO", 3),
    ]);

    expect(ids(columns.TODO)).toEqual(["a", "c"]);
    expect(ids(columns.IDEA)).toEqual(["b"]);
    expect(columns.DONE).toEqual([]);
  });
});

describe("moveInColumns", () => {
  it("moves a card to another column at the given place", () => {
    const next = moveInColumns(BOARD, { id: "a", status: "TODO", index: 0 });

    expect(ids(next.IDEA)).toEqual(["b", "c"]);
    expect(ids(next.TODO)).toEqual(["a", "d"]);
    expect(next.TODO[0].status).toBe("TODO");
  });

  it("puts a card into an empty column", () => {
    const next = moveInColumns(BOARD, { id: "d", status: "DONE", index: 0 });

    expect(ids(next.DONE)).toEqual(["d"]);
    expect(next.TODO).toEqual([]);
  });

  it("reorders inside a column, counting the places among the cards that stay", () => {
    const next = moveInColumns(BOARD, { id: "a", status: "IDEA", index: 2 });

    expect(ids(next.IDEA)).toEqual(["b", "c", "a"]);
  });

  it("moves a card up inside its column", () => {
    const next = moveInColumns(BOARD, { id: "c", status: "IDEA", index: 0 });

    expect(ids(next.IDEA)).toEqual(["c", "a", "b"]);
  });

  it("clamps an index past the end to the end", () => {
    const next = moveInColumns(BOARD, { id: "a", status: "TODO", index: 99 });

    expect(ids(next.TODO)).toEqual(["d", "a"]);
  });

  it("clamps a negative index to the start", () => {
    const next = moveInColumns(BOARD, { id: "a", status: "TODO", index: -3 });

    expect(ids(next.TODO)).toEqual(["a", "d"]);
  });

  it("returns the same board for a card that is not on it", () => {
    expect(moveInColumns(BOARD, { id: "zzz", status: "TODO", index: 0 })).toBe(
      BOARD,
    );
  });

  it("does not change the board it is given", () => {
    const before = JSON.stringify(BOARD);

    moveInColumns(BOARD, { id: "a", status: "DONE", index: 0 });

    expect(JSON.stringify(BOARD)).toBe(before);
  });

  it("leaves the columns it does not touch as they were", () => {
    const next = moveInColumns(BOARD, { id: "a", status: "TODO", index: 0 });

    expect(next.DEPLOYED).toBe(BOARD.DEPLOYED);
    expect(next.DONE).toBe(BOARD.DONE);
  });
});

describe("placeIndex", () => {
  it("is where a card dropped before another one lands", () => {
    expect(placeIndex(["a", "b", "c"], "b", "before", "x")).toBe(1);
  });

  it("is one past it for a card dropped after another one", () => {
    expect(placeIndex(["a", "b", "c"], "b", "after", "x")).toBe(2);
  });

  it("does not count the card that is moving", () => {
    // Moving "a" after "c" inside [a, b, c]: among the ones that stay (b, c) it goes to the end.
    expect(placeIndex(["a", "b", "c"], "c", "after", "a")).toBe(2);
    // Moving "c" before "a": it goes to the start.
    expect(placeIndex(["a", "b", "c"], "a", "before", "c")).toBe(0);
  });

  it("goes to the end when the target is not in the column", () => {
    expect(placeIndex(["a", "b"], "gone", "before", "x")).toBe(2);
  });
});
