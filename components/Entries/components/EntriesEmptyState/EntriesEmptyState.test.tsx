// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BanknotesIcon } from "@heroicons/react/24/outline";

import { EntriesEmptyState as Base } from "./EntriesEmptyState";
import type { EntriesEmptyStateProps } from "./types";

const COPY = {
  empty: {
    icon: BanknotesIcon,
    title: "Todavía no hay ingresos",
    hint: "Agrega tu primer ingreso para empezar a registrar lo que recibes.",
    action: "Agregar ingreso",
  },
  filtered: {
    title: "Ningún ingreso coincide con estos filtros",
    hint: "Prueba cambiando las fechas, la categoría o la moneda.",
  },
};

const EntriesEmptyState = (props: Omit<EntriesEmptyStateProps, "copy">) => (
  <Base copy={COPY} {...props} />
);

describe("empty variant (no incomes at all)", () => {
  it("offers 'Add income' with a plus icon", () => {
    render(<EntriesEmptyState variant="empty" onAction={() => {}} />);

    const button = screen.getByRole("button", { name: "Agregar ingreso" });
    const icon = button.querySelector("svg");

    expect(icon).not.toBeNull();
    // Decorative: the accessible name stays the plain label.
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("calls onAction when the button is pressed", () => {
    const onAction = vi.fn();

    render(<EntriesEmptyState variant="empty" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("without an action", () => {
  it("shows no button, for a filtered view that is already back at its defaults", () => {
    render(<EntriesEmptyState variant="filtered" />);

    expect(
      screen.getByText("Ningún ingreso coincide con estos filtros"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("filtered variant (incomes exist, none match)", () => {
  it("offers 'Clear filters' without a plus icon, since it adds nothing", () => {
    render(<EntriesEmptyState variant="filtered" onAction={() => {}} />);

    const button = screen.getByRole("button", { name: "Limpiar filtros" });

    expect(button.querySelector("svg")).toBeNull();
  });
});

describe("copy", () => {
  it("shows the title and hint it is given for each variant", () => {
    const { rerender } = render(<Base copy={COPY} variant="empty" />);

    expect(screen.getByText("Todavía no hay ingresos")).toBeInTheDocument();
    expect(screen.getByText(COPY.empty.hint)).toBeInTheDocument();

    rerender(<Base copy={COPY} variant="filtered" />);

    expect(screen.getByText(COPY.filtered.hint)).toBeInTheDocument();
  });

  it("uses the words of another entry kind", () => {
    render(
      <Base
        variant="empty"
        onAction={() => {}}
        copy={{
          ...COPY,
          empty: {
            ...COPY.empty,
            title: "Todavía no hay gastos",
            action: "Agregar gasto",
          },
        }}
      />,
    );

    expect(screen.getByText("Todavía no hay gastos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar gasto" }),
    ).toBeInTheDocument();
  });
});
