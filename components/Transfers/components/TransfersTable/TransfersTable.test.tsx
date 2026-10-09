// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TransferRow } from "../../types";
import { TransfersTable } from "./TransfersTable";

const ROWS: TransferRow[] = [
  {
    id: "tr_1",
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    fromLabel: "Galicia · Caja de ahorro",
    toLabel: "Efectivo · Efectivo",
    currency: "ARS",
    amount: 150050,
    date: "2026-10-03",
    notes: "Alquiler",
    amountLabel: "$ 1.500,50",
    amountDecimal: "1500.50",
    dateLabel: "3 oct 2026",
  },
  {
    id: "tr_2",
    fromAccountId: "acc_c",
    toAccountId: "acc_d",
    fromLabel: "Nación · Dólares",
    toLabel: "Efectivo · Dólares",
    currency: "USD",
    amount: 2500,
    date: "2026-10-01",
    notes: null,
    amountLabel: "US$ 25,00",
    amountDecimal: "25.00",
    dateLabel: "1 oct 2026",
  },
];

const renderTable = (
  patch: Partial<Parameters<typeof TransfersTable>[0]> = {},
) => {
  const handlers = {
    onAdd: vi.fn(),
    onClearFilters: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSelectionChange: vi.fn(),
  };

  render(
    <TransfersTable rows={ROWS} isFiltered={false} {...handlers} {...patch} />,
  );

  return handlers;
};

const KNOWN_HEADERS = [
  "Acciones",
  "Fecha",
  "Origen",
  "Destino",
  "Monto",
  "Moneda",
  "Notas",
];

describe("TransfersTable", () => {
  it("has the columns date, source, destination, amount, currency and notes, with an actions column, in that order", () => {
    renderTable();

    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent ?? "")
      .filter((text) => KNOWN_HEADERS.includes(text));

    expect(headers).toEqual(KNOWN_HEADERS);
  });

  it("shows each transfer as a row: date, both accounts as 'Banco · Cuenta', amount, currency and notes", () => {
    renderTable();

    const first = screen.getAllByRole("row")[1];

    expect(within(first).getByText("3 oct 2026")).toBeVisible();
    expect(within(first).getByText("Galicia · Caja de ahorro")).toBeVisible();
    expect(within(first).getByText("Efectivo · Efectivo")).toBeVisible();
    expect(within(first).getByText("$ 1.500,50")).toBeVisible();
    expect(within(first).getByText("ARS")).toBeVisible();
    expect(within(first).getByText("Alquiler")).toBeVisible();
  });

  it("says 'Sin notas' for a transfer without them", () => {
    renderTable();

    expect(screen.getByText("Sin notas")).toBeVisible();
  });

  it("edits and deletes through the buttons of each row, named after the transfer", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Eliminar Transferencia de Nación · Dólares a Efectivo · Dólares",
      }),
    );

    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
    expect(onDelete).toHaveBeenCalledWith(ROWS[1]);
  });

  it("locks the buttons of a row that is being deleted", () => {
    renderTable({ deletingIds: new Set(["tr_1"]) });

    expect(
      screen.getByRole("button", {
        name: "Editar Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo",
      }),
    ).toBeDisabled();
  });

  it("has a checkbox per row and one for the whole page", () => {
    renderTable({ selectedIds: new Set(["tr_1"]) });

    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("invites to create the first transfer when the month has none", () => {
    const { onAdd } = renderTable({ rows: [] });

    expect(screen.getByText("No hay transferencias en este mes")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Crear transferencia" }),
    );

    expect(onAdd).toHaveBeenCalled();
  });

  it("says nothing matches, and offers to clear the filters, when filters leave no row", () => {
    const { onClearFilters } = renderTable({ rows: [], isFiltered: true });

    expect(
      screen.getByText("Ninguna transferencia coincide con estos filtros"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }));

    expect(onClearFilters).toHaveBeenCalled();
  });

  it("shows skeleton rows while loading, not the empty state", () => {
    renderTable({ rows: [], isLoading: true });

    expect(screen.queryByText("No hay transferencias en este mes")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando transferencias",
    );
  });

  describe("selection", () => {
    const FIRST =
      "Transferencia de Galicia · Caja de ahorro a Efectivo · Efectivo";
    const SECOND = "Transferencia de Nación · Dólares a Efectivo · Dólares";

    it("reports the id of a ticked row", () => {
      const { onSelectionChange } = renderTable();

      fireEvent.click(
        screen.getByRole("checkbox", { name: `Seleccionar ${SECOND}` }),
      );

      expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["tr_2"]));
    });

    it("selects every id from the header checkbox", () => {
      const { onSelectionChange } = renderTable();

      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Seleccionar todas las filas de esta página",
        }),
      );

      expect(onSelectionChange.mock.calls[0][0]).toEqual(
        new Set(["tr_1", "tr_2"]),
      );
    });

    it("shows the selected ids as checked and the others not", () => {
      renderTable({ selectedIds: new Set(["tr_1"]) });

      expect(
        screen.getByRole("checkbox", { name: `Seleccionar ${FIRST}` }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: `Seleccionar ${SECOND}` }),
      ).not.toBeChecked();
    });

    it("locks the delete button and the checkbox of a row being deleted, and only of that row", () => {
      renderTable({ deletingIds: new Set(["tr_1"]) });

      expect(
        screen.getByRole("button", { name: `Eliminar ${FIRST}` }),
      ).toBeDisabled();
      expect(
        screen.getByRole("checkbox", { name: `Seleccionar ${FIRST}` }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: `Eliminar ${SECOND}` }),
      ).toBeEnabled();
      expect(
        screen.getByRole("checkbox", { name: `Seleccionar ${SECOND}` }),
      ).toBeEnabled();
    });
  });
});
