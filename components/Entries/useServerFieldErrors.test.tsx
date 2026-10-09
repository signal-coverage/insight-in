// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useServerFieldErrors } from "./useServerFieldErrors";

describe("useServerFieldErrors", () => {
  it("starts with no errors", () => {
    const { result } = renderHook(() => useServerFieldErrors());

    expect(result.current.fieldErrors).toEqual({});
  });

  it("holds the errors the server answered with", () => {
    const { result } = renderHook(() => useServerFieldErrors());

    act(() => result.current.setFieldErrors({ amount: ["Sin fondos."] }));

    expect(result.current.fieldErrors).toEqual({ amount: ["Sin fondos."] });
  });

  it("clears every error at once when an input that can change the verdict changes", () => {
    const { result } = renderHook(() => useServerFieldErrors());

    act(() =>
      result.current.setFieldErrors({
        amount: ["Sin fondos."],
        cardId: ["Sin cuenta."],
      }),
    );
    act(() => result.current.clearFieldErrors());

    expect(result.current.fieldErrors).toEqual({});
  });

  it("keeps the same object when there was nothing to clear, so it causes no re-render", () => {
    const { result } = renderHook(() => useServerFieldErrors());
    const before = result.current.fieldErrors;

    act(() => result.current.clearFieldErrors());

    expect(result.current.fieldErrors).toBe(before);
  });

  it("returns stable functions across renders, so they are safe in effect dependencies", () => {
    const { result, rerender } = renderHook(() => useServerFieldErrors());
    const { setFieldErrors, clearFieldErrors } = result.current;

    rerender();

    expect(result.current.setFieldErrors).toBe(setFieldErrors);
    expect(result.current.clearFieldErrors).toBe(clearFieldErrors);
  });
});
