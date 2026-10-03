// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstallmentMarker } from "./InstallmentMarker";

describe("InstallmentMarker", () => {
  it("is an image named Compra en cuotas", () => {
    render(<InstallmentMarker />);

    const marker = screen.getByRole("img", { name: "Compra en cuotas" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
  });

  it("says the same text as a tooltip when it is focused", () => {
    render(<InstallmentMarker />);

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("img", { name: "Compra en cuotas" }).focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent("Compra en cuotas");
  });
});
