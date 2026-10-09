// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
      "Cuenta",
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
    expect(first).toHaveTextContent("Banco Galicia · Caja de ahorro");
    expect(first).toHaveTextContent("5 sept 2026");
    expect(first).toHaveTextContent("$ 350.000,50");
    expect(first).toHaveTextContent("Paid by transfer");
  });

  it("shows a dash for an expense without notes", () => {
    renderTable();

    const cells = within(bodyRows()[1]).getAllByRole("gridcell");

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

describe("ExpensesTable status column", () => {
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

describe("ExpensesTable covered installments", () => {
  const COVERED: ExpenseRow = {
    ...ROW,
    id: "exp_3",
    description: "Heladera (3/12)",
    status: "COVERED",
    installmentPlanId: "plan_1",
    installmentNumber: 3,
  };

  it("shows a marker instead of the checkbox, named 'Cubierta por otro'", () => {
    renderTable([COVERED]);

    const [row] = bodyRows();
    const statusCell = within(row).getAllByRole("gridcell")[1];
    const marker = within(statusCell).getByRole("img", {
      name: "Cubierta por otro",
    });

    expect(marker.querySelector("title")).toBeNull();
    expect(within(statusCell).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps the checkbox for the installments that are not covered", () => {
    renderTable([
      { ...COVERED, id: "exp_4", status: "PLANNED" },
      { ...COVERED, id: "exp_5", status: "SETTLED" },
    ]);

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(
      screen.queryByRole("img", { name: "Cubierta por otro" }),
    ).not.toBeInTheDocument();
  });

  it("centers the marker in its cell, like the checkbox", () => {
    renderTable([COVERED]);

    const statusCell = within(bodyRows()[0]).getAllByRole("gridcell")[1];

    expect(statusCell.firstElementChild).toHaveClass("flex", "justify-center");
  });

  it("is not interactive", () => {
    const { onToggleStatus } = renderTable([COVERED]);

    fireEvent.click(screen.getByRole("img", { name: "Cubierta por otro" }));

    expect(onToggleStatus).not.toHaveBeenCalled();
  });
});

describe("ExpensesTable covered ordinary expenses", () => {
  const COVERED_ORDINARY: ExpenseRow = {
    ...ROW,
    id: "exp_6",
    status: "COVERED",
    installmentPlanId: null,
    installmentNumber: null,
    cardId: null,
    purchaseDate: null,
  };

  it("shows the covered marker instead of the checkbox, with no installment involved", () => {
    renderTable([COVERED_ORDINARY]);

    const statusCell = within(bodyRows()[0]).getAllByRole("gridcell")[1];

    expect(
      within(statusCell).getByRole("img", { name: "Cubierta por otro" }),
    ).toBeInTheDocument();
    expect(within(statusCell).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("is not interactive", () => {
    const { onToggleStatus } = renderTable([COVERED_ORDINARY]);

    fireEvent.click(screen.getByRole("img", { name: "Cubierta por otro" }));

    expect(onToggleStatus).not.toHaveBeenCalled();
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

describe("ExpensesTable installment marker", () => {
  const INSTALLMENT: ExpenseRow = {
    ...ROW,
    description: "Heladera (3/12)",
    installmentPlanId: "plan_1",
    installmentNumber: 3,
  };

  it("marks an installment with a credit card, next to its description", () => {
    renderTable([INSTALLMENT]);

    const marker = screen.getByRole("img", { name: "Compra en cuotas" });

    expect(marker.querySelector("title")).toBeNull();
    expect(marker.parentElement).toHaveTextContent("Heladera (3/12)");
  });

  it("shows no installment marker on an ordinary expense", () => {
    renderTable();

    expect(
      screen.queryByRole("img", { name: "Compra en cuotas" }),
    ).not.toBeInTheDocument();
  });

  it("shows the credit card instead of the recurring icon, since an installment belongs to its plan", () => {
    renderTable([INSTALLMENT]);

    expect(
      screen.queryByRole("img", { name: "Recurrente" }),
    ).not.toBeInTheDocument();
  });
});

describe("ExpensesTable account column", () => {
  it("names the account of each expense as 'Banco · Cuenta', cut with an ellipsis when long", () => {
    renderTable();

    const header = screen.getByRole("columnheader", { name: "Cuenta" });

    expect(header).toHaveClass("w-44", "overflow-hidden", "text-ellipsis");
    expect(
      within(bodyRows()[0]).getByText("Banco Galicia · Caja de ahorro"),
    ).toBeInTheDocument();
  });

  it("no longer draws a cash marker beside the description", () => {
    renderTable([{ ...ROW, accountLabel: "Efectivo · Efectivo" }]);

    expect(
      within(bodyRows()[0]).getByText("Efectivo · Efectivo"),
    ).toBeInTheDocument();
    expect(
      within(bodyRows()[0]).queryByRole("img", { name: "Efectivo" }),
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

// React Aria only opens a tooltip on focus when the focus came from the keyboard, and a table first
// takes the focus itself (a keyboard user tabs into the table, then on to what is in its cells).
const focusWithKeyboard = (element: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: "Tab" });
  act(() => screen.getByRole("grid").focus());
  act(() => element.focus());
};

describe("ExpensesTable tooltips", () => {
  it("shows the full description as a tooltip when the cut text is focused, not as a title", () => {
    renderTable();

    const description = screen.getByText("Monthly rent");

    expect(description).not.toHaveAttribute("title");
    expect(description).toHaveAttribute("tabindex", "0");

    focusWithKeyboard(description);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Monthly rent");
  });

  it("shows the full notes as a tooltip when they are focused", () => {
    renderTable();

    const notes = screen.getByText("Paid by transfer");

    expect(notes).not.toHaveAttribute("title");

    focusWithKeyboard(notes);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Paid by transfer");
  });

  it("gives the markers a tooltip with their own text", () => {
    renderTable([{ ...ROW, isRecurring: true }]);

    focusWithKeyboard(screen.getByRole("img", { name: "Recurrente" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Recurrente");
  });

  it("gives the covered marker a tooltip with its text", () => {
    renderTable([{ ...ROW, status: "COVERED" }]);

    focusWithKeyboard(screen.getByRole("img", { name: "Cubierta por otro" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Cubierta por otro");
  });
});

describe("ExpensesTable as a HeroUI table", () => {
  it("is named after what it lists and reads the description as the row's title", () => {
    renderTable();

    expect(screen.getByRole("grid", { name: "Gastos" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("rowheader").map((cell) => cell.textContent),
    ).toEqual(["Monthly rent", "Gym"]);
  });

  it("makes the Description, Category and Date headers sortable, and no other", () => {
    renderTable();

    const sortable = screen
      .getAllByRole("columnheader")
      .filter((header) => header.hasAttribute("data-allows-sorting"))
      .map((header) => header.textContent?.trim());

    expect(sortable).toEqual(["Descripción", "Categoría", "Fecha"]);
    expect(screen.getByRole("columnheader", { name: /Fecha/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("reports the next sort from a header press, starting Date and others in their own direction", () => {
    const onSortChange = vi.fn();

    render(
      <ExpensesTable
        rows={[ROW]}
        isFiltered={false}
        sort={{ key: "date", direction: "desc" }}
        onSortChange={onSortChange}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("columnheader", { name: /Fecha/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "date",
      direction: "asc",
    });

    fireEvent.click(screen.getByRole("columnheader", { name: /Categoría/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      key: "category",
      direction: "asc",
    });
  });

  it("gives the skeleton the very same column classes as the data, so the widths never jump", () => {
    const loaded = render(
      <ExpensesTable
        rows={[ROW]}
        isFiltered={false}
        sort={{ key: "date", direction: "desc" }}
        onSortChange={() => {}}
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleStatus={() => {}}
      />,
    );
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

    const loading = render(
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

    expect(classesOf(loading.container)).toEqual(withData);
  });
});

// A 20 USD subscription that really cost 35.000 ARS.
const QUOTED_IN_USD: ExpenseRow = {
  ...ROW,
  id: "exp_3",
  description: "Netflix",
  amount: 3500000,
  amountLabel: "$ 35.000,00",
  amountDecimal: "35000.00",
  originCurrency: "USD",
  originAmount: 2000,
  originAmountDecimal: "20.00",
  originLabel: "Se cotizó en 20 USD",
  originTooltip: "Se cotizó en US$ 20,00 · cotización 1.750,00",
};

describe("ExpensesTable origin marker", () => {
  it("marks an expense that was quoted in another currency, next to its description", () => {
    renderTable([QUOTED_IN_USD]);

    const marker = screen.getByRole("img", { name: "Se cotizó en 20 USD" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
    expect(marker.parentElement).toHaveTextContent("Netflix");
  });

  it("says the exact price and the implied rate in its tooltip", () => {
    renderTable([QUOTED_IN_USD]);

    focusWithKeyboard(screen.getByRole("img", { name: "Se cotizó en 20 USD" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Se cotizó en US$ 20,00 · cotización 1.750,00",
    );
  });

  it("shows no marker for an expense without an origin", () => {
    renderTable();

    expect(screen.queryByRole("img", { name: /^Se cotizó en/ })).toBeNull();
  });

  it("keeps the real amount as the only amount of the row", () => {
    renderTable([QUOTED_IN_USD]);

    const cells = within(bodyRows()[0]).getAllByRole("gridcell");

    expect(cells[cells.length - 2]).toHaveTextContent("$ 35.000,00");
    expect(cells[cells.length - 2]).not.toHaveTextContent("USD");
  });

  it("can show it next to the other markers", () => {
    renderTable([{ ...QUOTED_IN_USD, isRecurring: true }]);

    expect(screen.getByRole("img", { name: "Recurrente" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Se cotizó en 20 USD" }),
    ).toBeInTheDocument();
  });
});

// A dentist visit of 10.000 that the health insurance is expected to pay back, 6.000 of it already.
const EXPECTS_REIMBURSEMENT: ExpenseRow = {
  ...ROW,
  id: "exp_4",
  description: "Dentista",
  amount: 1000000,
  amountLabel: "$ 10.000,00",
  amountDecimal: "10000.00",
  expectedReimbursement: 1000000,
  reimbursementReceived: 600000,
  expectedReimbursementDecimal: "10000.00",
  reimbursementTooltip: "Te deben $ 4.000,00 de $ 10.000,00",
};

describe("ExpensesTable reimbursement marker", () => {
  it("marks an expense that expects to be paid back, next to its description", () => {
    renderTable([EXPECTS_REIMBURSEMENT]);

    const marker = screen.getByRole("img", { name: "Reintegro esperado" });

    expect(marker.tagName.toLowerCase()).toBe("svg");
    expect(marker.parentElement).toHaveTextContent("Dentista");
  });

  it("says how much is still owed, out of what is expected, in its tooltip", () => {
    renderTable([EXPECTS_REIMBURSEMENT]);

    focusWithKeyboard(screen.getByRole("img", { name: "Reintegro esperado" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Te deben $ 4.000,00 de $ 10.000,00",
    );
  });

  it("says the reimbursement is complete once nothing is owed", () => {
    renderTable([
      {
        ...EXPECTS_REIMBURSEMENT,
        reimbursementReceived: 1000000,
        reimbursementTooltip: "Reintegro completo",
      },
    ]);

    focusWithKeyboard(screen.getByRole("img", { name: "Reintegro esperado" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Reintegro completo");
  });

  it("shows no marker for an expense that expects nothing", () => {
    renderTable();

    expect(
      screen.queryByRole("img", { name: "Reintegro esperado" }),
    ).toBeNull();
  });
});
