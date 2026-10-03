// @vitest-environment jsdom
import { WalletIcon } from "@heroicons/react/24/outline";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkerIcon } from "./MarkerIcon";

const renderMarker = () =>
  render(<MarkerIcon icon={WalletIcon} label="Efectivo" className="size-4" />);

describe("MarkerIcon", () => {
  it("is an image named after its label, with the classes it is given", () => {
    renderMarker();

    const marker = screen.getByRole("img", { name: "Efectivo" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
    expect(marker).toHaveClass("size-4");
    expect(marker).not.toHaveAttribute("aria-hidden", "true");
  });

  it("is the one tab stop and no button, and has no title tooltip of its own", () => {
    renderMarker();

    const marker = screen.getByRole("img", { name: "Efectivo" });

    expect(marker).toHaveAttribute("tabindex", "0");
    expect(marker.querySelector("title")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows its label as a tooltip on keyboard focus", () => {
    renderMarker();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("img", { name: "Efectivo" }).focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent("Efectivo");
  });

  it("shows its label as a tooltip once the mouse has rested on it for a moment", () => {
    vi.useFakeTimers();

    try {
      renderMarker();

      const marker = screen.getByRole("img", { name: "Efectivo" });

      // A real mouse moves before it enters: that move is what tells React Aria it is the pointer.
      fireEvent.pointerMove(marker, { pointerType: "mouse" });
      fireEvent.pointerEnter(marker, { pointerType: "mouse" });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByRole("tooltip")).toHaveTextContent("Efectivo");
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes the tooltip again when the mouse leaves", () => {
    vi.useFakeTimers();

    try {
      renderMarker();

      const marker = screen.getByRole("img", { name: "Efectivo" });

      fireEvent.pointerMove(marker, { pointerType: "mouse" });
      fireEvent.pointerEnter(marker, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByRole("tooltip")).toBeInTheDocument();

      fireEvent.pointerLeave(marker, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("can say more in its tooltip than in its accessible name", () => {
    render(
      <MarkerIcon
        icon={WalletIcon}
        label="Viene de 1.000 USDC"
        tooltip="Viene de 1.000,00 USDC · cotización 1.200,00"
      />,
    );

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("img", { name: "Viene de 1.000 USDC" }).focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Viene de 1.000,00 USDC · cotización 1.200,00",
    );
  });
});
