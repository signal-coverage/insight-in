// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRowSelection } from "./useRowSelection";

describe("useRowSelection", () => {
  it("starts with nothing selected", () => {
    const { result } = renderHook(() => useRowSelection());

    expect(result.current.among(["a", "b"]).size).toBe(0);
  });

  it("keeps the keys it is given", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.select(new Set(["a", "c"])));

    expect(result.current.among(["a", "b", "c"])).toEqual(new Set(["a", "c"]));
  });

  it("only reports the selected keys that are still among the rows", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.select(new Set(["a", "gone"])));

    expect(result.current.among(["a", "b"])).toEqual(new Set(["a"]));
  });

  it("clears the selection", () => {
    const { result } = renderHook(() => useRowSelection());

    act(() => result.current.select(new Set(["a"])));
    act(() => result.current.clear());

    expect(result.current.among(["a"]).size).toBe(0);
  });
});
