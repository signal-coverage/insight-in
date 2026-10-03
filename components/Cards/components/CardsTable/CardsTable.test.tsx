// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CardRow } from "../../types";
import { CardsTable } from "./CardsTable";

const VISA: CardRow = {
  id: "card_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
  committedTotal: 90000000,
  monthUsed: 7500000,
  used: 7500000,
  available: 22500000,
  tier: "available",
  title: "Visa •••• 1234",
  brandName: "Visa",
  closingLabel: "Día 25",
  dueLabel: "Día 5",
  limitLabel: "$ 300.000,00 por mes",
  usedLabel: "$ 75.000,00 de $ 300.000,00",
  availableLabel: "$ 225.000,00",
  limitDecimal: "300000.00",
  percent: 25,
};

const MASTERCARD: CardRow = {
  ...VISA,
  id: "card_2",
  last4: "9876",
  brand: "MASTERCARD",
  limitMode: "TOTAL",
  limitAmount: 120000000,
  used: 100000000,
  available: 20000000,
  tier: "near",
  title: "Mastercard •••• 9876",
  brandName: "Mastercard",
  closingLabel: "Día 31",
  dueLabel: "Día 10",
  limitLabel: "$ 1.200.000,00 en total",
  usedLabel: "$ 1.000.000,00 de $ 1.200.000,00",
  availableLabel: "$ 200.000,00",
  percent: 83,
};

const EXCEEDED: CardRow = {
  ...VISA,
  id: "card_3",
  last4: "0007",
  brand: "OTHER",
  used: 35000000,
  available: -5000000,
  tier: "exceeded",
  title: "Otra •••• 0007",
  brandName: "Otra",
  usedLabel: "$ 350.000,00 de $ 300.000,00",
  availableLabel: "-$ 50.000,00",
  percent: 100,
};

const renderTable = (rows: CardRow[] = [VISA, MASTERCARD, EXCEEDED]) => {
  const onAdd = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  render(
    <CardsTable
      rows={rows}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  );

  return { onAdd, onEdit, onDelete };
};

const bodyRows = () => screen.getAllByRole("row").slice(1);
// The card column names the row, so HeroUI marks its cell as a row header rather than a grid cell.
const cellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));

describe("CardsTable columns", () => {
  it("lists Actions first, then the card, its cycle, its cap, its use and what is available", () => {
    renderTable();

    expect(
      screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim()),
    ).toEqual([
      "Acciones",
      "Tarjeta",
      "Cierre",
      "Vencimiento",
      "Tope",
      "Uso",
      "Disponible",
    ]);
  });

  it("writes the card with its brand and last four digits", () => {
    renderTable();

    const cells = bodyRows().map((row) => cellsOf(row)[1].textContent);

    expect(cells).toEqual([
      "Visa •••• 1234",
      "Mastercard •••• 9876",
      "Otra •••• 0007",
    ]);
  });

  it("shows the logo of the brand before the title, as a decoration", () => {
    renderTable();

    const logos = bodyRows().map((row) => {
      const logo = cellsOf(row)[1].querySelector("[data-brand-logo]");

      return [
        logo?.getAttribute("data-brand-logo"),
        logo?.getAttribute("aria-hidden"),
      ];
    });

    expect(logos).toEqual([
      ["VISA", "true"],
      ["MASTERCARD", "true"],
      ["OTHER", "true"],
    ]);
  });

  it("shows the closing and the due day of the statement", () => {
    renderTable();

    const [first, second] = bodyRows();

    expect(cellsOf(first)[2]).toHaveTextContent("Día 25");
    expect(cellsOf(first)[3]).toHaveTextContent("Día 5");
    expect(cellsOf(second)[2]).toHaveTextContent("Día 31");
    expect(cellsOf(second)[3]).toHaveTextContent("Día 10");
  });

  it("shows the cap with its mode: per month or in total", () => {
    renderTable();

    const [first, second] = bodyRows();

    expect(cellsOf(first)[4]).toHaveTextContent("$ 300.000,00 por mes");
    expect(cellsOf(second)[4]).toHaveTextContent("$ 1.200.000,00 en total");
  });

  it("shows what was used of the cap", () => {
    renderTable();

    expect(cellsOf(bodyRows()[0])[5]).toHaveTextContent(
      "$ 75.000,00 de $ 300.000,00",
    );
  });

  it("shows what is still available, with its sign when the cap was exceeded", () => {
    renderTable();

    const [first, , third] = bodyRows();

    expect(cellsOf(first)[6]).toHaveTextContent("$ 225.000,00");
    expect(cellsOf(third)[6]).toHaveTextContent("-$ 50.000,00");
  });

  it("calls the handlers with the right row", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Visa •••• 1234" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Mastercard •••• 9876" }),
    );

    expect(onEdit).toHaveBeenCalledWith(VISA);
    expect(onDelete).toHaveBeenCalledWith(MASTERCARD);
  });
});

describe("CardsTable usage", () => {
  it("shows a progress bar per card, as full as the share of the cap that was used", () => {
    renderTable();

    const bars = screen.getAllByRole("progressbar");

    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual([
      "25",
      "83",
      "100",
    ]);
    expect(bars[0]).toHaveAccessibleName("Uso de Visa •••• 1234");
  });

  it("names the tier in words next to the bar, never only with a colour", () => {
    renderTable();

    const [first, second, third] = bodyRows();

    expect(cellsOf(first)[5]).toHaveTextContent("Disponible");
    expect(cellsOf(second)[5]).toHaveTextContent("Cerca del tope");
    expect(cellsOf(third)[5]).toHaveTextContent("Excedida");
  });

  it("gives each tier its own icon", () => {
    renderTable();

    const icons = bodyRows().map((row) => {
      const icon = cellsOf(row)[5].querySelector("svg[data-tier]");

      return icon?.getAttribute("data-tier");
    });

    expect(icons).toEqual(["available", "near", "exceeded"]);
  });

  it("colours the bar of each tier differently", () => {
    renderTable();

    const [first, second, third] = screen.getAllByRole("progressbar");

    expect(first.className).toContain("--positive");
    expect(second.className).toContain("--warning");
    expect(third.className).toContain("--danger");
  });
});

describe("CardsTable column widths", () => {
  it("uses a fixed layout, so a column's width never depends on what is inside it", () => {
    renderTable();

    expect(screen.getByRole("grid")).toHaveClass("table-fixed");
  });

  it("keeps the Actions column as wide as its two buttons, with the title centered", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Acciones" })).toHaveClass(
      "w-[7.25rem]",
      "text-center",
      "px-4",
    );
  });

  it("gives the columns that hold short values a width of their own and leaves the card to take the rest", () => {
    renderTable();

    ["Cierre", "Vencimiento", "Tope", "Uso", "Disponible"].forEach((name) => {
      expect(screen.getByRole("columnheader", { name }).className).toMatch(
        /\bw-/,
      );
    });
    expect(
      screen.getByRole("columnheader", { name: "Tarjeta" }).className,
    ).not.toMatch(/\bw-/);
  });

  it("aligns the available amount to the end, like the amounts of the other tables", () => {
    renderTable();

    expect(
      screen.getByRole("columnheader", { name: "Disponible" }),
    ).toHaveClass("text-right");
  });
});

describe("CardsTable while the cards are on their way", () => {
  it("sizes its text placeholders relative to their cell, so they can never overflow a fixed column", () => {
    const { container } = render(
      <CardsTable
        rows={[]}
        isLoading
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    const cells = Array.from(
      container.querySelectorAll("tbody tr:first-child td"),
    );
    // The actions hold fixed-size buttons; the other six hold text.
    const textCells = cells.slice(1);

    expect(textCells).toHaveLength(6);
    textCells.forEach((cell) => {
      expect(cell.querySelector(".skeleton")?.className).toMatch(
        /\bw-(\d+\/\d+|full)\b/,
      );
    });
  });

  it("swaps the rows for skeleton rows", () => {
    render(
      <CardsTable
        rows={[VISA]}
        isLoading
        onAdd={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.queryByText("Visa •••• 1234")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tarjetas");
  });
});

describe("CardsTable without cards", () => {
  it("invites the user to add the first card", () => {
    const { onAdd } = renderTable([]);

    expect(screen.getByText("Todavía no tenés tarjetas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});

describe("CardsTable as a HeroUI table", () => {
  it("is named after what it lists and reads the card as the row's title", () => {
    renderTable();

    expect(screen.getByRole("grid", { name: "Tarjetas" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("rowheader").map((cell) => cell.textContent),
    ).toEqual(["Visa •••• 1234", "Mastercard •••• 9876", "Otra •••• 0007"]);
  });

  it("has no sortable header, since the cards come in a fixed order", () => {
    renderTable();

    screen.getAllByRole("columnheader").forEach((header) => {
      expect(header).not.toHaveAttribute("data-allows-sorting");
    });
  });
});

describe("CardsTable tooltips", () => {
  // A keyboard user tabs into the table first, then on to what is in its cells.
  const focusWithKeyboard = (element: HTMLElement) => {
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => screen.getByRole("grid").focus());
    act(() => element.focus());
  };

  it("shows the whole card title as a tooltip, instead of a title", () => {
    renderTable();

    const title = screen.getByText("Visa •••• 1234");

    expect(title).not.toHaveAttribute("title");
    expect(title).toHaveAttribute("tabindex", "0");

    focusWithKeyboard(title);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Visa •••• 1234");
  });

  it("shows the whole used-of-cap text as a tooltip", () => {
    renderTable();

    const used = screen.getByText("$ 75.000,00 de $ 300.000,00");

    expect(used).not.toHaveAttribute("title");

    focusWithKeyboard(used);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "$ 75.000,00 de $ 300.000,00",
    );
  });
});
