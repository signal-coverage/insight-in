// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EntryStatus } from "@/core/entries/status";

import { useOptimisticStatus } from "./useOptimisticStatus";

interface Row {
  id: string;
  status: EntryStatus;
}

const ROWS: Row[] = [
  { id: "a", status: "PLANNED" },
  { id: "b", status: "SETTLED" },
];

// Every save a test starts and does not finish itself is finished after it. React keeps all the
// async transitions in flight entangled, so one left pending would hold the optimistic state of
// the tests that come after it.
const unfinished: Array<() => void> = [];

// A save the test finishes by hand, to look at the moments in between.
const slowSave = () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
        unfinished.push(resolve);
      }),
  );

  return { save, finish: () => finish() };
};

afterEach(async () => {
  await act(async () => {
    unfinished.splice(0).forEach((finish) => finish());
  });
});

const statuses = (rows: readonly Row[]) =>
  Object.fromEntries(rows.map((row) => [row.id, row.status]));

describe("useOptimisticStatus", () => {
  it("leaves the rows as they are while nothing has been toggled", () => {
    const { result } = renderHook(() => useOptimisticStatus(vi.fn()));

    expect(result.current.apply(ROWS)).toEqual(ROWS);
  });

  it("shows the new status at once and asks for it to be saved", async () => {
    const { save } = slowSave();
    const { result } = renderHook(() => useOptimisticStatus(save));

    await act(async () => result.current.toggle("a", true));

    expect(save).toHaveBeenCalledWith("a", "SETTLED");
    expect(statuses(result.current.apply(ROWS))).toEqual({
      a: "SETTLED",
      b: "SETTLED",
    });
  });

  it("untoggles the same way", async () => {
    const { save } = slowSave();
    const { result } = renderHook(() => useOptimisticStatus(save));

    await act(async () => result.current.toggle("b", false));

    expect(save).toHaveBeenCalledWith("b", "PLANNED");
    expect(statuses(result.current.apply(ROWS)).b).toBe("PLANNED");
  });

  it("keeps the new status for as long as the save takes, not only until the first render", async () => {
    const { save } = slowSave();
    const { result, rerender } = renderHook(() => useOptimisticStatus(save));

    await act(async () => result.current.toggle("a", true));
    rerender();
    rerender();

    expect(statuses(result.current.apply(ROWS)).a).toBe("SETTLED");
  });

  it("hands the rows back to the server's own answer once the save is over", async () => {
    const { save, finish } = slowSave();
    const { result } = renderHook(() => useOptimisticStatus(save));

    await act(async () => result.current.toggle("a", true));
    await act(async () => finish());

    // The rows that arrive from the server decide from here on.
    await waitFor(() =>
      expect(statuses(result.current.apply(ROWS)).a).toBe("PLANNED"),
    );
    expect(
      statuses(result.current.apply([{ id: "a", status: "SETTLED" }])).a,
    ).toBe("SETTLED");
  });

  it("only touches the row that was toggled", async () => {
    const { save } = slowSave();
    const { result } = renderHook(() => useOptimisticStatus(save));

    await act(async () => result.current.toggle("a", true));

    expect(result.current.apply(ROWS)[1]).toBe(ROWS[1]);
  });

  it("keeps every other field of the row", async () => {
    const { save } = slowSave();
    const { result } = renderHook(() => useOptimisticStatus(save));
    const rows = [{ id: "a", status: "PLANNED" as const, description: "Luz" }];

    await act(async () => result.current.toggle("a", true));

    expect(result.current.apply(rows)[0]).toEqual({
      id: "a",
      status: "SETTLED",
      description: "Luz",
    });
  });
});
