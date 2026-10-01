// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IncomeRow } from "../../types";
import { IncomesTable } from "./IncomesTable";

const ROW: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Salary",
  notes: "Paid by wire transfer",
  recurringIncomeId: null,
  status: "SETTLED",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  dateLabel: "1 sept 2026",
};

const NO_NOTES: IncomeRow = {
  ...ROW,
  id: "inc_2",
  description: "Side gig",
  notes: null,
};

const renderTable = (rows: IncomeRow[] = [ROW, NO_NOTES]) => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onToggleStatus = vi.fn();

  render(
    <IncomesTable
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

describe("IncomesTable columns", () => {
  it("lists Actions first, Status second and Notes as a column of its own, in this order", () => {
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

  it("puts the edit and delete buttons in the first cell of every row", () => {
    renderTable();

    bodyRows().forEach((row) => {
      const firstCell = within(row).getAllByRole("cell")[0];

      expect(
        within(firstCell).getByRole("button", { name: /^Editar / }),
      ).toBeInTheDocument();
      expect(
        within(firstCell).getByRole("button", { name: /^Eliminar / }),
      ).toBeInTheDocument();
    });
  });

  it("calls the handlers with the right row", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Monthly salary" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Side gig" }));

    expect(onEdit).toHaveBeenCalledWith(ROW);
    expect(onDelete).toHaveBeenCalledWith(NO_NOTES);
  });
});

describe("IncomesTable notes", () => {
  it("shows the notes in the Notes column, not under the description", () => {
    renderTable();

    const [withNotes] = bodyRows();
    const cells = within(withNotes).getAllByRole("cell");
    const descriptionCell = cells[2];
    const notesCell = cells[cells.length - 1];

    expect(notesCell).toHaveTextContent("Paid by wire transfer");
    expect(descriptionCell).toHaveTextContent("Monthly salary");
    expect(descriptionCell).not.toHaveTextContent("Paid by wire transfer");
  });

  it("shows a dash for an income without notes", () => {
    renderTable();

    const [, withoutNotes] = bodyRows();
    const cells = within(withoutNotes).getAllByRole("cell");

    expect(cells[cells.length - 1]).toHaveTextContent("—");
  });

  it("keeps long notes on one line and readable in full on hover", () => {
    const long =
      "A very long note that would otherwise push the whole table wider than the screen";

    renderTable([{ ...ROW, notes: long }]);

    const cells = within(bodyRows()[0]).getAllByRole("cell");
    const text = within(cells[cells.length - 1]).getByText(long);

    expect(text).toHaveAttribute("title", long);
    expect(text.className).toContain("truncate");
  });
});

describe("IncomesTable while loading", () => {
  const renderLoading = () =>
    render(
      <IncomesTable
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

  it("announces that it is loading and shows skeleton rows instead of the empty state", () => {
    renderLoading();

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Cargando ingresos",
    );
    expect(
      screen.queryByText("Todavía no hay ingresos"),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("tbody .skeleton").length).toBeGreaterThan(
      0,
    );
  });

  it("already shows the real column headers, in the same order", () => {
    renderLoading();

    // The loading table is aria-hidden on purpose (the status above announces the wait), so the
    // headers only show up when hidden elements are included.
    const headers = screen
      .getAllByRole("columnheader", { hidden: true })
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
});

describe("IncomesTable while rows are on their way", () => {
  it("sizes its text placeholders relative to their cell, so they can never overflow a fixed column", () => {
    const { container } = render(
      <IncomesTable
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
      <IncomesTable
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

    expect(screen.queryByText("Monthly salary")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("IncomesTable recurring marker", () => {
  it("still marks incomes generated by a recurring template", () => {
    renderTable([{ ...ROW, recurringIncomeId: "rec_1" }]);

    expect(screen.getByRole("img", { name: "Recurrente" })).toBeInTheDocument();
  });
});

describe("IncomesTable column widths", () => {
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

describe("IncomesTable status column", () => {
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

  it("has a checkbox per row, ticked for collected incomes only", () => {
    renderTable([ROW, { ...NO_NOTES, status: "PLANNED" }]);

    const [collected, planned] = screen.getAllByRole("checkbox");

    expect(collected).toBeChecked();
    expect(planned).not.toBeChecked();
  });

  it("names each checkbox after its income", () => {
    renderTable();

    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Monthly salary como cobrado",
      }),
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
