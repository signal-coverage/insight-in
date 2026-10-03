// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDeleteScope } from "./useDeleteScope";

describe("useDeleteScope", () => {
  it("starts with only the entry to delete, which can be confirmed at once", () => {
    const { result } = renderHook(() => useDeleteScope());

    expect(result.current.scope).toBe("entry");
    expect(result.current.acknowledged).toBe(false);
    expect(result.current.canConfirm).toBe(true);
  });

  it("cannot confirm the whole plan until the user acknowledges it", () => {
    const { result } = renderHook(() => useDeleteScope());

    act(() => result.current.selectScope("plan"));

    expect(result.current.scope).toBe("plan");
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.setAcknowledged(true));

    expect(result.current.canConfirm).toBe(true);
  });

  it("forgets the acknowledgement whenever the choice changes, so it never carries over", () => {
    const { result } = renderHook(() => useDeleteScope());

    act(() => result.current.selectScope("plan"));
    act(() => result.current.setAcknowledged(true));
    act(() => result.current.selectScope("entry"));
    act(() => result.current.selectScope("plan"));

    expect(result.current.acknowledged).toBe(false);
    expect(result.current.canConfirm).toBe(false);
  });
});
