// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddAccountTile } from "./AddAccountTile";

describe("AddAccountTile", () => {
  it("reads '+ Nueva cuenta' and says which bank it adds to", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", {
      name: "+ Nueva cuenta en Banco Galicia",
    });

    expect(tile).toHaveTextContent("+ Nueva cuenta");
  });

  it("shows the text of its name and nothing else, centered", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", {
      name: "+ Nueva cuenta en Banco Galicia",
    });

    expect(tile.textContent).toBe("+ Nueva cuenta");
    expect(tile.getAttribute("aria-label")).toContain(tile.textContent);
    expect(tile).toHaveClass("items-center", "justify-center");
  });

  it("starts a new account in that bank when pressed", () => {
    const onAdd = vi.fn();

    render(
      <AddAccountTile bankId="bank_1" bankName="Banco Galicia" onAdd={onAdd} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    );

    expect(onAdd).toHaveBeenCalledWith("bank_1");
  });

  it("is a muted card with a dashed border, so it differs from an account", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", {
      name: "+ Nueva cuenta en Banco Galicia",
    });

    expect(tile).toHaveClass(
      "border",
      "border-dashed",
      "border-border",
      "text-muted",
      "rounded-2xl!",
      "w-44",
      "min-h-24",
    );
    expect(tile.className).not.toMatch(
      /(^|\s)(ring-1|ring-border|bg-surface-secondary)(\s|$)/,
    );
  });

  it("still reads as clickable: hover and a visible focus ring", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    ).toHaveClass(
      "hover:bg-surface-secondary",
      "focus-visible:ring-2",
      "focus-visible:ring-focus",
    );
  });

  it("opts out of the global button size", () => {
    render(
      <AddAccountTile
        bankId="bank_1"
        bankName="Banco Galicia"
        onAdd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    ).toHaveClass("app-button--full-width", "app-button--row-height");
  });
});
