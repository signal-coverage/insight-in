// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  installmentPlanId: null,
  installmentNumber: null,
  status: "SETTLED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
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
      "Cuenta",
      "Fecha",
      "Monto",
      "Notas",
    ]);
  });

  it("puts the edit and delete buttons in the first cell of every row", () => {
    renderTable();

    bodyRows().forEach((row) => {
      const firstCell = within(row).getAllByRole("gridcell")[0];

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
    const cells = within(withNotes).getAllByRole("gridcell");
    const descriptionCell = within(withNotes).getByRole("rowheader");
    const notesCell = cells[cells.length - 1];

    expect(notesCell).toHaveTextContent("Paid by wire transfer");
    expect(descriptionCell).toHaveTextContent("Monthly salary");
    expect(descriptionCell).not.toHaveTextContent("Paid by wire transfer");
  });

  it("shows a dash for an income without notes", () => {
    renderTable();

    const [, withoutNotes] = bodyRows();
    const cells = within(withoutNotes).getAllByRole("gridcell");

    expect(cells[cells.length - 1]).toHaveTextContent("—");
  });

  it("keeps long notes on one line and readable in full in a tooltip", () => {
    const long =
      "A very long note that would otherwise push the whole table wider than the screen";

    renderTable([{ ...ROW, notes: long }]);

    const cells = within(bodyRows()[0]).getAllByRole("gridcell");
    const text = within(cells[cells.length - 1]).getByText(long);

    expect(text).not.toHaveAttribute("title");
    expect(text).toHaveAttribute("tabindex", "0");
    expect(text.className).toContain("truncate");

    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("grid").focus());
    act(() => text.focus());

    expect(screen.getByRole("tooltip")).toHaveTextContent(long);
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
      "Cuenta",
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
    // Status and actions hold fixed-size controls; the other six hold text.
    const textCells = cells.slice(2);

    expect(textCells).toHaveLength(6);
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

describe("IncomesTable repayment marker", () => {
  it("marks the installments of a loan repaid in cuotas, next to their description", () => {
    renderTable([
      { ...ROW, installmentPlanId: "plan_1", installmentNumber: 2 },
    ]);

    const marker = screen.getByRole("img", { name: "Devolución en cuotas" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
    expect(marker.parentElement).toHaveTextContent("Monthly salary");
  });

  it("wears no credit card: that is for the purchases of the expenses", () => {
    renderTable([
      { ...ROW, installmentPlanId: "plan_1", installmentNumber: 2 },
    ]);

    expect(
      screen.queryByRole("img", { name: "Compra en cuotas" }),
    ).not.toBeInTheDocument();
  });

  it("shows no marker for an ordinary income", () => {
    renderTable();

    expect(
      screen.queryByRole("img", { name: "Devolución en cuotas" }),
    ).not.toBeInTheDocument();
  });

  it("gives it a tooltip with its own text", () => {
    renderTable([
      { ...ROW, installmentPlanId: "plan_1", installmentNumber: 1 },
    ]);

    focusWithKeyboard(
      screen.getByRole("img", { name: "Devolución en cuotas" }),
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Devolución en cuotas",
    );
  });
});

const FROM_USDC: IncomeRow = {
  ...ROW,
  amount: 120000000,
  currency: "ARS",
  amountLabel: "$ 1.200.000,00",
  originCurrency: "USDC",
  originAmount: 1000000000,
  originAmountDecimal: "1000.00",
  originLabel: "Viene de 1.000 USDC",
  originTooltip: "Viene de 1.000,00 USDC · cotización 1.200,00",
};

describe("IncomesTable origin marker", () => {
  it("marks an income that came from another currency, next to its description", () => {
    renderTable([FROM_USDC]);

    const marker = screen.getByRole("img", { name: "Viene de 1.000 USDC" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
    expect(marker.parentElement).toHaveTextContent("Monthly salary");
  });

  it("says the exact amount and the implied rate in its tooltip", () => {
    renderTable([FROM_USDC]);

    focusWithKeyboard(screen.getByRole("img", { name: "Viene de 1.000 USDC" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Viene de 1.000,00 USDC · cotización 1.200,00",
    );
  });

  it("shows no marker for an income without an origin", () => {
    renderTable();

    expect(screen.queryByRole("img", { name: /^Viene de/ })).toBeNull();
  });

  it("keeps the net amount as the only amount of the row, in its own column", () => {
    renderTable([FROM_USDC]);

    const cells = within(bodyRows()[0]).getAllByRole("gridcell");

    expect(cells[cells.length - 2]).toHaveTextContent("$ 1.200.000,00");
    expect(cells[cells.length - 2]).not.toHaveTextContent("USDC");
  });

  it("can show it next to the other markers", () => {
    renderTable([{ ...FROM_USDC, recurringIncomeId: "rec_1" }]);

    expect(screen.getByRole("img", { name: "Recurrente" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Viene de 1.000 USDC" }),
    ).toBeInTheDocument();
  });
});

describe("IncomesTable account column", () => {
  it("names the account of each income as 'Banco · Cuenta', cut with an ellipsis when long", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Cuenta" })).toHaveClass(
      "w-44",
      "overflow-hidden",
      "text-ellipsis",
    );
    expect(
      within(bodyRows()[0]).getByText("Banco Galicia · Caja de ahorro"),
    ).toBeInTheDocument();
  });

  it("draws no cash marker any more: the account says where the money is", () => {
    // A row still carrying the retired medium must not bring the marker back.
    renderTable([
      {
        ...ROW,
        medium: "CASH",
        accountLabel: "Efectivo · Efectivo",
      } as IncomeRow,
    ]);

    expect(
      within(bodyRows()[0]).getByText("Efectivo · Efectivo"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Efectivo" })).toBeNull();
  });
});

describe("IncomesTable column widths", () => {
  it("uses a fixed layout, so a column's width never depends on what is inside it", () => {
    renderTable();

    expect(screen.getByRole("grid")).toHaveClass(
      "table-fixed",
      "min-w-[59rem]",
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

    // 16px on each side: the checkbox column leads the table, so the edge inset is not this column's.
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toHaveClass(
      "w-[7.25rem]",
      "text-center",
      "px-4",
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
      const statusCell = within(row).getAllByRole("gridcell")[1];

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

// A keyboard user tabs into the table first, then on to what is in its cells.
const focusWithKeyboard = (element: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: "Tab" });
  act(() => screen.getByRole("grid").focus());
  act(() => element.focus());
};

describe("IncomesTable as a HeroUI table", () => {
  it("is named after what it lists and reads the description as the row's title", () => {
    renderTable();

    expect(screen.getByRole("grid", { name: "Ingresos" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("rowheader").map((cell) => cell.textContent),
    ).toEqual(["Monthly salary", "Side gig"]);
  });

  it("makes the Description, Category and Date headers sortable, and no other", () => {
    renderTable();

    const sortable = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("data-allows-sorting"))
      .map((header) => header.textContent?.trim());

    expect(sortable).toEqual(["Descripción", "Categoría", "Fecha"]);
  });
});

describe("IncomesTable tooltips", () => {
  it("shows the whole description as a tooltip on keyboard focus, instead of a title", () => {
    renderTable();

    const description = screen.getByText("Monthly salary");

    expect(description).not.toHaveAttribute("title");
    expect(description).toHaveAttribute("tabindex", "0");

    focusWithKeyboard(description);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Monthly salary");
  });

  it("gives the recurring marker a tooltip with its own text", () => {
    renderTable([{ ...ROW, recurringIncomeId: "rec_1" }]);

    focusWithKeyboard(screen.getByRole("img", { name: "Recurrente" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Recurrente");
  });
});

describe("IncomesTable reimbursement marker", () => {
  const PAYS_BACK: IncomeRow = {
    ...ROW,
    id: "inc_3",
    description: "Reintegro obra social",
    reimbursesExpenseId: "exp_1",
    reimbursesExpenseDescription: "Dentista",
    reimbursementTooltip: "Devolución de: Dentista",
  };

  it("marks an income that pays an expense back, next to its description", () => {
    renderTable([PAYS_BACK]);

    const marker = screen.getByRole("img", { name: "Devolución de un gasto" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
    expect(marker.parentElement).toHaveTextContent("Reintegro obra social");
  });

  it("names the expense it pays back in its tooltip", () => {
    renderTable([PAYS_BACK]);

    focusWithKeyboard(
      screen.getByRole("img", { name: "Devolución de un gasto" }),
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Devolución de: Dentista",
    );
  });

  it("shows no marker for an income that pays nothing back", () => {
    renderTable();

    expect(
      screen.queryByRole("img", { name: "Devolución de un gasto" }),
    ).toBeNull();
  });
});
