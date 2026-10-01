// @vitest-environment jsdom
import { PlusIcon } from "@heroicons/react/24/outline";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PendingButton } from "./PendingButton";

describe("PendingButton when idle", () => {
  it("shows its label and icon, and is a plain button unless told otherwise", () => {
    render(
      <PendingButton
        Icon={PlusIcon}
        label="Agregar"
        pendingLabel="Agregando…"
      />,
    );

    const button = screen.getByRole("button", { name: "Agregar" });
    const icon = button.querySelector("svg");

    expect(button).toHaveAttribute("type", "button");
    expect(icon).not.toBeNull();
    // Decorative: the accessible name stays the plain label.
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(button.querySelector(".spinner")).toBeNull();
  });

  it("can submit a form that lives elsewhere in the page", () => {
    render(
      <PendingButton
        type="submit"
        form="income-form"
        label="Guardar"
        pendingLabel="Guardando…"
      />,
    );

    const button = screen.getByRole("button", { name: "Guardar" });

    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("form", "income-form");
  });

  it("shows only the label when it has no icon", () => {
    render(<PendingButton label="Guardar" pendingLabel="Guardando…" />);

    expect(
      screen.getByRole("button", { name: "Guardar" }).querySelector("svg"),
    ).toBeNull();
  });

  it("passes the usual button props through: variant, onPress, disabled", () => {
    const onPress = vi.fn();

    const { rerender } = render(
      <PendingButton
        variant="danger"
        label="Eliminar"
        pendingLabel="Eliminando…"
        onPress={onPress}
      />,
    );

    const button = screen.getByRole("button", { name: "Eliminar" });

    expect(button.className).toContain("button--danger");

    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    rerender(
      <PendingButton
        isDisabled
        label="Eliminar"
        pendingLabel="Eliminando…"
        onPress={onPress}
      />,
    );
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
  });
});

describe("PendingButton while pending", () => {
  it("swaps the label for the pending one and the icon for a spinner", () => {
    render(
      <PendingButton
        isPending
        Icon={PlusIcon}
        label="Agregar"
        pendingLabel="Agregando…"
      />,
    );

    const button = screen.getByRole("button", { name: /Agregando/ });

    expect(button).toHaveTextContent("Agregando…");
    expect(button.querySelector(".spinner")).not.toBeNull();
    // The "+" is gone: the spinner takes its place instead of sitting next to it.
    expect(
      button.querySelector("svg[aria-hidden='true']:not(.spinner svg)"),
    ).toBeNull();
  });

  it("is the default: with no pending label it keeps its own label and adds the spinner", () => {
    render(<PendingButton isPending label="Eliminar" />);

    const button = screen.getByRole("button", { name: /Eliminar/ });

    expect(button).toHaveTextContent("Eliminar");
    expect(button.querySelector(".spinner")).not.toBeNull();
  });

  it("is marked pending and does not fire its handler again", () => {
    const onPress = vi.fn();

    render(
      <PendingButton
        isPending
        label="Guardar"
        pendingLabel="Guardando…"
        onPress={onPress}
      />,
    );

    const button = screen.getByRole("button", { name: /Guardando…/ });

    expect(button).toHaveAttribute("data-pending");

    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  // The spinner is a role="status" labelled "Loading", so the button's accessible name reads
  // "Loading Saving…": tests match on the text, not the whole name.
  it("announces the loading state to assistive technology", () => {
    render(
      <PendingButton isPending label="Guardar" pendingLabel="Guardando…" />,
    );

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
