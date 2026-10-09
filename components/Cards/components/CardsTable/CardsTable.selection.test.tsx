// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { creditCardRow } from "../../testRows";
import type { CardRow } from "../../types";
import { CardsTable } from "./CardsTable";
import type { CardsTableProps } from "./types";

const VISA: CardRow = creditCardRow();

const MASTERCARD: CardRow = creditCardRow({
  id: "card_2",
  last4: "9876",
  brand: "MASTERCARD",
  title: "Mastercard •••• 9876",
  brandName: "Mastercard",
});

const renderTable = (props: Partial<CardsTableProps> = {}) => {
  const handlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onSelectionChange: vi.fn(),
  };

  const view = render(
    <CardsTable
      rows={[VISA, MASTERCARD]}
      onAdd={() => {}}
      selectedIds={new Set()}
      {...handlers}
      {...props}
    />,
  );

  return { ...view, ...handlers };
};

describe("CardsTable selection", () => {
  it("puts the checkbox column before Acciones", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");

    expect(
      within(headers[0]).getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    ).toBeInTheDocument();
    expect(headers[1]).toHaveTextContent("Acciones");
    expect(headers).toHaveLength(10);
  });

  it("names each row's checkbox after the card and reports the ids", () => {
    const { onSelectionChange } = renderTable();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar Mastercard •••• 9876",
      }),
    );

    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["card_2"]));
  });

  it("selects the whole page from the header", () => {
    const { onSelectionChange } = renderTable();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(onSelectionChange.mock.calls[0][0]).toEqual(
      new Set(["card_1", "card_2"]),
    );
  });

  it("has no selection column when nothing listens to it", () => {
    renderTable({ onSelectionChange: undefined });

    expect(screen.getAllByRole("columnheader")).toHaveLength(9);
  });

  it("keeps the same column classes while loading, the checkbox column included", () => {
    const classesOf = (container: HTMLElement) => ({
      headers: Array.from(container.querySelectorAll("th")).map(
        (header) => header.className,
      ),
      cells: Array.from(
        container.querySelectorAll("tbody tr:first-child td"),
      ).map((cell) => cell.className),
    });
    const loaded = renderTable();
    const withData = classesOf(loaded.container);

    loaded.unmount();

    expect(
      classesOf(renderTable({ rows: [], isLoading: true }).container),
    ).toEqual(withData);
    expect(withData.headers[0]).toContain("w-11");
  });
});

describe("CardsTable rows being deleted", () => {
  it("locks every control of the row, and only of that row", () => {
    renderTable({ deletingIds: new Set(["card_1"]) });

    expect(
      screen.getByRole("button", { name: "Editar Visa •••• 1234" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Visa •••• 1234" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Visa •••• 1234" }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", { name: "Editar Mastercard •••• 9876" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar Mastercard •••• 9876",
      }),
    ).toBeEnabled();
  });

  it("does not edit or delete the locked row", () => {
    const { onEdit, onDelete } = renderTable({
      deletingIds: new Set(["card_1"]),
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Visa •••• 1234" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Visa •••• 1234" }),
    );

    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("dims the row and announces that it is being deleted", () => {
    const { container } = renderTable({ deletingIds: new Set(["card_1"]) });

    const rows = within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

    expect(rows[0]).toHaveAttribute("data-busy", "true");
    expect(rows[1]).not.toHaveAttribute("data-busy");
    expect(container.querySelector("[aria-live='polite']")).toHaveTextContent(
      "Eliminando…",
    );
  });
});
