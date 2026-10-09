// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddBankRow } from "./AddBankRow";

const renderRow = (onAdd = vi.fn()) => {
  render(
    <ul>
      <AddBankRow onAdd={onAdd} />
    </ul>,
  );

  return { onAdd, add: screen.getByRole("button", { name: "+ Nuevo banco" }) };
};

describe("AddBankRow", () => {
  it("is a real list item with one button named exactly '+ Nuevo banco'", () => {
    const { add } = renderRow();

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(add).toHaveTextContent(/^\+ Nuevo banco$/);
    expect(add).toHaveAttribute("type", "button");
  });

  it("asks to add a bank when pressed", () => {
    const { onAdd, add } = renderRow();

    fireEvent.click(add);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("is one dashed, muted card, rounded like the other cards, with the button opt-outs", () => {
    const { add } = renderRow();

    expect(add).toHaveClass(
      "app-button--full-width",
      "app-button--row-height",
      "rounded-2xl!",
      "border",
      "border-dashed",
      "border-border",
      "text-muted",
      "min-h-24",
      "w-full",
      "items-center",
      "justify-center",
      "hover:bg-surface-secondary",
      "focus-visible:ring-2",
      "focus-visible:ring-focus",
    );
    expect(add.className).not.toMatch(/blue|(^|\s)ring-1/);
  });

  it("is as wide as the visible board and stays in view when the board scrolls sideways", () => {
    const { add } = renderRow();
    const frame = add.parentElement as HTMLElement;

    expect(frame).toHaveClass(
      "sticky",
      "left-0",
      "w-[100cqw]",
      "shrink-0",
      "p-3",
    );
    expect(frame.parentElement).toHaveClass("flex");
    expect(frame.parentElement?.className).not.toMatch(
      /(^|\s)(border|border-\S+|divide-\S+|bg-\S+)(\s|$)/,
    );
  });
});
