// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExpenseRow } from "../../types";
import { ExpensesTable } from "./ExpensesTable";
import type { ExpensesTableProps } from "./types";

const ROW: ExpenseRow = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  status: "PLANNED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  isRecurring: false,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  expectedReimbursementDecimal: null,
  reimbursementTooltip: null,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dateLabel: "5 sept 2026",
};

const GYM: ExpenseRow = { ...ROW, id: "exp_2", description: "Gym" };

const renderTable = (props: Partial<ExpensesTableProps> = {}) => {
  const handlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleStatus: vi.fn(),
    onSelectionChange: vi.fn(),
  };

  const view = render(
    <ExpensesTable
      rows={[ROW, GYM]}
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

describe("ExpensesTable selection", () => {
  it("puts the checkbox column before Acciones", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");

    expect(
      within(headers[0]).getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    ).toBeInTheDocument();
    expect(headers[1]).toHaveTextContent("Acciones");
    expect(headers).toHaveLength(9);
  });

  it("names each row's checkbox after its description", () => {
    renderTable();

    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Monthly rent" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Gym" }),
    ).toBeInTheDocument();
  });

  it("reports the ids when a row is ticked", () => {
    const { onSelectionChange } = renderTable();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Gym" }));

    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set(["exp_2"]));
  });

  it("selects the whole page from the header and shows a partial selection as indeterminate", () => {
    const { onSelectionChange, unmount } = renderTable();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(onSelectionChange.mock.calls[0][0]).toEqual(
      new Set(["exp_1", "exp_2"]),
    );

    unmount();
    renderTable({ selectedIds: new Set(["exp_1"]) });

    expect(
      (
        screen.getByRole("checkbox", {
          name: "Seleccionar todas las filas de esta página",
        }) as HTMLInputElement
      ).indeterminate,
    ).toBe(true);
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Monthly rent" }),
    ).toBeChecked();
  });

  it("keeps the status checkbox and the buttons working next to the selection", () => {
    const { onToggleStatus, onSelectionChange } = renderTable();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Marcar Gym como pagado" }),
    );

    expect(onToggleStatus).toHaveBeenCalledWith(GYM, true);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("has no selection column when nothing listens to it", () => {
    renderTable({ onSelectionChange: undefined });

    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
    expect(
      screen.queryByRole("checkbox", { name: "Seleccionar Gym" }),
    ).not.toBeInTheDocument();
  });

  it("gives the checkbox column a narrow fixed width, loaded and loading alike", () => {
    const loaded = renderTable();

    expect(screen.getAllByRole("columnheader")[0]).toHaveClass("w-11");

    const classesOf = (container: HTMLElement) => ({
      table: container.querySelector("table")?.className,
      headers: Array.from(container.querySelectorAll("th")).map(
        (header) => header.className,
      ),
      cells: Array.from(
        container.querySelectorAll("tbody tr:first-child td"),
      ).map((cell) => cell.className),
    });
    const withData = classesOf(loaded.container);

    loaded.unmount();

    const loading = renderTable({ rows: [], isLoading: true });

    expect(classesOf(loading.container)).toEqual(withData);
    expect(
      loading.container
        .querySelectorAll("tbody tr:first-child td")[0]
        .querySelector(".skeleton"),
    ).not.toBeNull();
  });
});

describe("ExpensesTable rows being deleted", () => {
  const deleting = () => new Set(["exp_1"]);

  it("locks every control of the row, and only of that row", () => {
    renderTable({ deletingIds: deleting() });

    expect(
      screen.getByRole("button", { name: "Editar Monthly rent" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Monthly rent" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Marcar Monthly rent como pagado" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Monthly rent" }),
    ).toBeDisabled();

    expect(screen.getByRole("button", { name: "Editar Gym" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar Gym" })).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Marcar Gym como pagado" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Gym" }),
    ).toBeEnabled();
  });

  it("does not edit or delete the locked row", () => {
    const { onEdit, onDelete } = renderTable({ deletingIds: deleting() });

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Monthly rent" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Monthly rent" }),
    );

    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("dims the row and says, for assistive technology, that it is being deleted", () => {
    const { container } = renderTable({ deletingIds: deleting() });

    const rows = within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

    expect(rows[0]).toHaveAttribute("data-busy", "true");
    expect(rows[0]).toHaveClass("opacity-50");
    expect(rows[1]).not.toHaveAttribute("data-busy");
    expect(container.querySelector("[aria-live='polite']")).toHaveTextContent(
      "Eliminando…",
    );
  });

  it("leaves everything working when no row is being deleted", () => {
    renderTable({ deletingIds: new Set() });

    expect(
      screen.getByRole("button", { name: "Editar Monthly rent" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Marcar Monthly rent como pagado" }),
    ).toBeEnabled();
  });
});
