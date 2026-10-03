// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TruncatedText } from "./TruncatedText";

const LONG = "A very long description that does not fit in its column";

// React Aria only opens a tooltip on focus when the focus came from the keyboard.
const focusWithKeyboard = (element: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: "Tab" });
  act(() => element.focus());
};

describe("TruncatedText", () => {
  it("renders the text with the classes it is given", () => {
    render(<TruncatedText className="truncate">{LONG}</TruncatedText>);

    expect(screen.getByText(LONG)).toHaveClass("truncate");
  });

  it("is a tab stop, so keyboard users can reach the tooltip, and not a button", () => {
    render(<TruncatedText>{LONG}</TruncatedText>);

    const text = screen.getByText(LONG);

    expect(text.tagName.toLowerCase()).toBe("span");
    expect(text).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not use the browser's title tooltip", () => {
    render(<TruncatedText>{LONG}</TruncatedText>);

    expect(screen.getByText(LONG)).not.toHaveAttribute("title");
  });

  it("shows the full text as a tooltip on keyboard focus", () => {
    render(<TruncatedText>{LONG}</TruncatedText>);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    focusWithKeyboard(screen.getByText(LONG));

    expect(screen.getByRole("tooltip")).toHaveTextContent(LONG);
  });

  it("shows the full text as a tooltip on hover", () => {
    vi.useFakeTimers();

    try {
      render(<TruncatedText>{LONG}</TruncatedText>);

      const text = screen.getByText(LONG);

      // React Aria only opens a tooltip on hover when the last interaction was the pointer's.
      fireEvent.pointerMove(document.body, { pointerType: "mouse" });
      fireEvent.pointerEnter(text, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByRole("tooltip")).toHaveTextContent(LONG);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the tooltip again when the text loses focus", () => {
    render(<TruncatedText>{LONG}</TruncatedText>);

    const text = screen.getByText(LONG);

    focusWithKeyboard(text);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    act(() => text.blur());

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
