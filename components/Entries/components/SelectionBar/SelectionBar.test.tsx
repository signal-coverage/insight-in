// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SelectionBar } from "./SelectionBar";

const renderBar = (
  props: Partial<React.ComponentProps<typeof SelectionBar>> = {},
) => {
  const onClear = vi.fn();
  const onDelete = vi.fn();

  render(
    <SelectionBar count={3} onClear={onClear} onDelete={onDelete} {...props} />,
  );

  return { onClear, onDelete };
};

const region = () =>
  screen.getByRole("region", { name: "Acciones para la selección" });

describe("SelectionBar", () => {
  it("is a region named after what it is for", () => {
    renderBar();

    expect(region()).toBeInTheDocument();
  });

  it("says how many rows are selected", () => {
    renderBar({ count: 3 });

    expect(region()).toHaveTextContent("3 seleccionadas");
  });

  it("uses the singular for exactly one", () => {
    renderBar({ count: 1 });

    expect(region()).toHaveTextContent("1 seleccionada");
    expect(region()).not.toHaveTextContent("1 seleccionadas");
  });

  it("announces the count politely when it changes", () => {
    renderBar({ count: 2 });

    expect(within(region()).getByText("2 seleccionadas")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("clears the selection from a tertiary button", () => {
    const { onClear } = renderBar();
    const button = within(region()).getByRole("button", {
      name: "Quitar selección",
    });

    expect(button.className).toContain("button--tertiary");

    fireEvent.click(button);

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("deletes the selection from a danger button with a visible label", () => {
    const { onDelete } = renderBar();
    const button = within(region()).getByRole("button", {
      name: "Eliminar selección",
    });

    expect(button).toHaveTextContent("Eliminar selección");
    expect(button.className).toContain("button--danger-soft");

    fireEvent.click(button);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("locks both buttons when disabled", () => {
    renderBar({ isDisabled: true });

    expect(
      screen.getByRole("button", { name: "Quitar selección" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar selección" }),
    ).toBeDisabled();
  });
});
