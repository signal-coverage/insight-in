// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExpenseRow } from "../../types";
import { ExpensesTable } from "./ExpensesTable";

const ROW: ExpenseRow = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: "Paid by transfer",
  status: "SETTLED",
  isRecurring: false,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dateLabel: "5 sept 2026",
};

const NO_NOTES: ExpenseRow = {
  ...ROW,
  id: "exp_2",
  description: "Gym",
  notes: null,
};

const renderTable = (rows: ExpenseRow[] = [ROW, NO_NOTES]) => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onToggleStatus = vi.fn();

  render(
    <ExpensesTable
      rows={rows}
      isFiltered={false}
      sort={{ key: "date", direction: "desc" }}
      onSortChange={() => {}}
      onAdd={() => {}}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleStatus={onToggleStatus}
    />,
  );

  return { onEdit, onDelete, onToggleStatus };
};

const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("ExpensesTable columns", () => {
  it("lists Actions first, Status second, then the expense's own columns", () => {
    renderTable();

    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.trim());

    expect(headers).toEqual([
      "Acciones",
      "Estado",
      "Descripción",
      "Categoría",
      "Fecha",
      "Monto",
      "Notas",
    ]);
  });

  it("shows the formatted values of each row", () => {
    renderTable();

    const [first] = bodyRows();

    expect(first).toHaveTextContent("Monthly rent");
    expect(first).toHaveTextContent("Alquiler");
    expect(first).toHaveTextContent("5 sept 2026");
    expect(first).toHaveTextContent("$ 350.000,50");
    expect(first).toHaveTextContent("Paid by transfer");
  });

  it("shows a dash for an expense without notes", () => {
    renderTable();

    const cells = within(bodyRows()[1]).getAllByRole("cell");

    expect(cells[cells.length - 1]).toHaveTextContent("—");
  });

  it("calls the handlers with the right row", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Monthly rent" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Gym" }));

    expect(onEdit).toHaveBeenCalledWith(ROW);
    expect(onDelete).toHaveBeenCalledWith(NO_NOTES);
  });
});

describe("ExpensesTable column widths", () => {
  it("uses a fixed layout, so a column's width never depends on what is inside it", () => {
    renderTable();

    expect(screen.getByRole("table")).toHaveClass(
      "table-fixed",
      "min-w-[48rem]",
    );
  });

  it("keeps the Status column as narrow as its title", () => {
    renderTable();

    // Centered like the checkbox under it.
    expect(screen.getByRole("columnheader", { name: "Estado" })).toHaveClass(
      "w-16",
      "text-center",
    );
  });

  it("keeps the Actions column as wide as its two buttons, with the title centered and the same padding on both sides", () => {
    renderTable();

    // The first column already has the table's 16px edge inset on its left; the right matches it.
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toHaveClass(
      "w-[7.25rem]",
      "text-center",
      "pr-4",
    );
  });

  it("gives the columns that hold short values a width of their own and leaves the free text to share the rest", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: /Categoría/ })).toHaveClass(
      "w-28",
    );
    expect(screen.getByRole("columnheader", { name: /Fecha/ })).toHaveClass(
      "w-28",
    );
    expect(screen.getByRole("columnheader", { name: "Monto" })).toHaveClass(
      "w-32",
    );
    expect(
      screen.getByRole("columnheader", { name: /Descripción/ }).className,
    ).not.toMatch(/\bw-/);
    expect(
      screen.getByRole("columnheader", { name: "Notas" }).className,
    ).not.toMatch(/\bw-/);
  });
});

describe("ExpensesTable status column", () => {
  it("centers the checkbox in its cell, of every row", () => {
    renderTable();

    bodyRows().forEach((row) => {
      const statusCell = within(row).getAllByRole("cell")[1];

      expect(statusCell.firstElementChild).toHaveClass(
        "flex",
        "justify-center",
      );
      expect(within(statusCell).getByRole("checkbox")).toBeInTheDocument();
    });
  });

  it("has a checkbox per row, ticked for paid expenses only", () => {
    renderTable([ROW, { ...NO_NOTES, status: "PLANNED" }]);

    const [paid, planned] = screen.getAllByRole("checkbox");

    expect(paid).toBeChecked();
    expect(planned).not.toBeChecked();
  });

  it("names each checkbox after its expense, with the word 'pagado'", () => {
    renderTable();

    expect(
      screen.getByRole("checkbox", { name: "Marcar Monthly rent como pagado" }),
    ).toBeInTheDocument();
  });

  it("reports the row and the new state when a checkbox is clicked", () => {
    const { onToggleStatus } = renderTable([{ ...ROW, status: "PLANNED" }]);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onToggleStatus).toHaveBeenCalledWith(
      { ...ROW, status: "PLANNED" },
      true,
    );
  });
});

describe("ExpensesTable recurring marker", () => {
  it("marks the expenses flagged as recurring", () => {
    renderTable([{ ...ROW, isRecurring: true }]);

    expect(screen.getByRole("img", { name: "Recurrente" })).toBeInTheDocument();
  });

  it("shows no marker otherwise", () => {
    renderTable();

    expect(
      screen.queryByRole("img", { name: "Recurrente" }),
    ).not.toBeInTheDocument();
  });
});

describe("ExpensesTable while rows are on their way", () => {
  it("sizes its text placeholders relative to their cell, so they can never overflow a fixed column", () => {
    const { container } = render(
      <ExpensesTable
        rows={[]}
        isLoading
        isFiltered={false}
        sort={{ key: "date", direction: "desc" }}
        onSortChange={() => {}}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />,
    );

    const cells = Array.from(
      container.querySelectorAll("tbody tr:first-child td"),
    );
    // Status and actions hold fixed-size controls; the other five hold text.
    const textCells = cells.slice(2);

    expect(textCells).toHaveLength(5);
    textCells.forEach((cell) => {
      expect(cell.querySelector(".skeleton")?.className).toMatch(
        /\bw-(\d+\/\d+|full)\b/,
      );
    });
  });

  it("swaps the rows for skeleton rows", () => {
    render(
      <ExpensesTable
        rows={[ROW]}
        isLoading
        isFiltered={false}
        sort={{ key: "date", direction: "desc" }}
        onSortChange={() => {}}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />,
    );

    expect(screen.queryByText("Monthly rent")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando gastos");
  });
});

describe("ExpensesTable without rows", () => {
  it("invites the user to add the first expense when there are none at all", () => {
    renderTable([]);

    expect(screen.getByText("Todavía no hay gastos")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar gasto" }),
    ).toBeInTheDocument();
  });

  it("says nothing matches when expenses exist elsewhere", () => {
    render(
      <ExpensesTable
        rows={[]}
        isFiltered
        sort={{ key: "date", direction: "desc" }}
        onSortChange={() => {}}
        onAdd={() => {}}
        onClearFilters={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />,
    );

    expect(
      screen.getByText("Ningún gasto coincide con estos filtros"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Limpiar filtros" }),
    ).toBeInTheDocument();
  });
});
