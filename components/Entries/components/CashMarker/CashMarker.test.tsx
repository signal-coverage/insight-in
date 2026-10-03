// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CashMarker } from "./CashMarker";

describe("CashMarker", () => {
  it("is an image named Efectivo", () => {
    render(<CashMarker />);

    const marker = screen.getByRole("img", { name: "Efectivo" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
  });

  it("says the same text as a tooltip when it is focused", () => {
    render(<CashMarker />);

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("img", { name: "Efectivo" }).focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent("Efectivo");
  });
});
