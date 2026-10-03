// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IncomeRow } from "../../types";
import { IncomesTable } from "./IncomesTable";
import type { IncomesTableProps } from "./types";

const ROW: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  status: "PLANNED",
  medium: "DIGITAL",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  dateLabel: "1 sept 2026",
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  reimbursesExpenseId: null,
  reimbursesExpenseDescription: null,
  reimbursementTooltip: null,
};

const GIG: IncomeRow = { ...ROW, id: "inc_2", description: "Side gig" };

const renderTable = (props: Partial<IncomesTableProps> = {}) => {
  const handlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleStatus: vi.fn(),
    onSelectionChange: vi.fn(),
  };

  const view = render(
    <IncomesTable
      rows={[ROW, GIG]}
      isFiltered={false}
      sort={{ key: "date", direction: "desc" }}
      onSortChange={() => {}}
      onAdd={() => {}}
      selectedIds={new Set()}
      {...handlers}
      {...props}
    />,
  );

  return { ...view, ...handlers };
};

describe("IncomesTable selection", () => {
  it("puts the checkbox column before Acciones", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");

    expect(
      within(headers[0]).getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    ).toBeInTheDocument();
    expect(headers[1]).toHaveTextContent("Acciones");
    expect(headers).toHaveLength(8);
  });

  it("names each row's checkbox after its description and reports the ids", () => {
    const { onSelectionChange } = renderTable();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Seleccionar Side gig" }),
    );

    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["inc_2"]));
  });

  it("selects the whole page from the header", () => {
    const { onSelectionChange } = renderTable();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(onSelectionChange.mock.calls[0][0]).toEqual(
      new Set(["inc_1", "inc_2"]),
    );
  });

  it("has no selection column when nothing listens to it", () => {
    renderTable({ onSelectionChange: undefined });

    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
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

describe("IncomesTable rows being deleted", () => {
  it("locks every control of the row, and only of that row", () => {
    renderTable({ deletingIds: new Set(["inc_1"]) });

    expect(
      screen.getByRole("button", { name: "Editar Monthly salary" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Monthly salary" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Monthly salary como cobrado",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Monthly salary" }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", { name: "Editar Side gig" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Side gig" }),
    ).toBeEnabled();
  });

  it("does not edit or delete the locked row", () => {
    const { onEdit, onDelete } = renderTable({
      deletingIds: new Set(["inc_1"]),
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Monthly salary" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Monthly salary" }),
    );

    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("dims the row and announces that it is being deleted", () => {
    const { container } = renderTable({ deletingIds: new Set(["inc_1"]) });

    const rows = within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

    expect(rows[0]).toHaveAttribute("data-busy", "true");
    expect(rows[1]).not.toHaveAttribute("data-busy");
    expect(container.querySelector("[aria-live='polite']")).toHaveTextContent(
      "Eliminando…",
    );
  });
});
