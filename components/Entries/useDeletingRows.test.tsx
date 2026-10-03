// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useTransition } from "react";
import { describe, expect, it } from "vitest";

import { useDeletingRows } from "./useDeletingRows";

const setup = () =>
  renderHook(() => {
    const deleting = useDeletingRows();
    const [, startTransition] = useTransition();

    return { ...deleting, startTransition };
  });

describe("useDeletingRows", () => {
  it("starts with no row being deleted", () => {
    const { result } = setup();

    expect(result.current.deletingIds.size).toBe(0);
  });

  it("keeps the rows marked for as long as the transition that deletes them runs", async () => {
    const { result } = setup();
    let finish!: () => void;

    await act(async () => {
      result.current.startTransition(async () => {
        result.current.markDeleting(["a", "b"]);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      });
    });

    expect(result.current.deletingIds).toEqual(new Set(["a", "b"]));

    await act(async () => finish());

    expect(result.current.deletingIds.size).toBe(0);
  });

  it("lets the rows go back to normal once the transition ends, which is what a failed delete needs", async () => {
    const { result } = setup();

    await act(async () => {
      result.current.startTransition(async () => {
        result.current.markDeleting(["a"]);
        await Promise.resolve();
      });
    });

    expect(result.current.deletingIds.size).toBe(0);
  });

  it("starts with no plan being deleted, and keeps a plan marked while its delete runs", async () => {
    const { result } = setup();
    let finish!: () => void;

    expect(result.current.deletingPlanIds.size).toBe(0);

    await act(async () => {
      result.current.startTransition(async () => {
        result.current.markDeletingPlan("plan_1");
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      });
    });

    expect(result.current.deletingPlanIds).toEqual(new Set(["plan_1"]));
    expect(result.current.deletingIds.size).toBe(0);

    await act(async () => finish());

    expect(result.current.deletingPlanIds.size).toBe(0);
  });
});
