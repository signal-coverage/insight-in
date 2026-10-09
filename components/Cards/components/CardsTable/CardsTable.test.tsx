// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { creditCardRow, debitCardRow, limitRow } from "../../testRows";
import type { CardRow } from "../../types";
import { CardsTable } from "./CardsTable";

const VISA: CardRow = creditCardRow();

// Two caps: pesos close to the cap, dollars over it.
const MASTERCARD: CardRow = creditCardRow({
  id: "card_2",
  last4: "9876",
  brand: "MASTERCARD",
  limitMode: "TOTAL",
  title: "Mastercard •••• 9876",
  brandName: "Mastercard",
  bankName: "Banco Nación",
  closingLabel: "Día 31",
  dueLabel: "Día 10",
  limits: [
    limitRow({
      limitLabel: "$ 1.200.000,00 en total",
      usedLabel: "$ 1.000.000,00 de $ 1.200.000,00",
      availableLabel: "$ 200.000,00",
      percent: 83,
      tier: "near",
    }),
    limitRow({
      currency: "USD",
      limitLabel: "US$ 1.000,00 en total",
      usedLabel: "US$ 1.100,00 de US$ 1.000,00",
      availableLabel: "-US$ 100,00",
      percent: 100,
      tier: "exceeded",
    }),
  ],
});

const DEBIT: CardRow = debitCardRow();

const renderTable = (rows: CardRow[] = [VISA, MASTERCARD, DEBIT]) => {
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
const cellsOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll<HTMLTableCellElement>("td"));

// 0 Acciones, 1 Tarjeta, 2 Tipo, 3 Banco, 4 Cierre, 5 Vencimiento, 6 Tope, 7 Uso, 8 Disponible.
describe("CardsTable columns", () => {
  it("lists Actions first, then the card, its kind and bank, its cycle, its caps, their use and what is available", () => {
    renderTable();

    expect(
      screen
        .getAllByRole("columnheader")
        .map((header) => header.textContent?.trim()),
    ).toEqual([
      "Acciones",
      "Tarjeta",
      "Tipo",
      "Banco",
      "Cierre",
      "Vencimiento",
      "Tope",
      "Uso",
      "Disponible",
    ]);
  });

  it("writes the card with its brand logo and last four digits", () => {
    renderTable();

    expect(bodyRows().map((row) => cellsOf(row)[1].textContent)).toEqual([
      "Visa •••• 1234",
      "Mastercard •••• 9876",
      "Mastercard •••• 9999",
    ]);
    expect(
      bodyRows().map((row) =>
        cellsOf(row)[1]
          .querySelector("[data-brand-logo]")
          ?.getAttribute("data-brand-logo"),
      ),
    ).toEqual(["VISA", "MASTERCARD", "MASTERCARD"]);
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
      ["MASTERCARD", "true"],
    ]);
  });

  it("names the kind of each card and its bank", () => {
    renderTable();

    expect(bodyRows().map((row) => cellsOf(row)[2].textContent)).toEqual([
      "Crédito",
      "Crédito",
      "Débito o prepago",
    ]);
    expect(bodyRows().map((row) => cellsOf(row)[3].textContent)).toEqual([
      "Banco Galicia",
      "Banco Nación",
      "AstroPay",
    ]);
  });

  it("shows the cycle of a credit card and a dash for a debit card", () => {
    renderTable();

    const [visa, , debit] = bodyRows();

    expect(cellsOf(visa)[4]).toHaveTextContent("Día 25");
    expect(cellsOf(visa)[5]).toHaveTextContent("Día 5");
    expect(cellsOf(debit)[4]).toHaveTextContent("—");
    expect(cellsOf(debit)[5]).toHaveTextContent("—");
  });

  it("shows one cap per currency for a credit card, and the currencies of a debit card without amounts", () => {
    renderTable();

    const [visa, master, debit] = bodyRows();

    expect(cellsOf(visa)[6]).toHaveTextContent("$ 300.000,00 por mes");
    expect(cellsOf(master)[6]).toHaveTextContent("$ 1.200.000,00 en total");
    expect(cellsOf(master)[6]).toHaveTextContent("US$ 1.000,00 en total");
    expect(cellsOf(debit)[6]).toHaveTextContent("ARS · USD");
  });

  it("shows what is available per cap, with its sign when a cap was exceeded, and a dash for a debit card", () => {
    renderTable();

    const [visa, master, debit] = bodyRows();

    expect(cellsOf(visa)[8]).toHaveTextContent("$ 225.000,00");
    expect(cellsOf(master)[8]).toHaveTextContent("$ 200.000,00");
    expect(cellsOf(master)[8]).toHaveTextContent("-US$ 100,00");
    expect(cellsOf(debit)[8]).toHaveTextContent("—");
  });

  it("calls the handlers with the right row", () => {
    const { onEdit, onDelete } = renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Visa •••• 1234" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Mastercard •••• 9999" }),
    );

    expect(onEdit).toHaveBeenCalledWith(VISA);
    expect(onDelete).toHaveBeenCalledWith(DEBIT);
  });
});

describe("CardsTable usage", () => {
  it("shows a progress bar per cap, as full as the share used, named by card and currency", () => {
    renderTable();

    const bars = screen.getAllByRole("progressbar");

    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual([
      "25",
      "83",
      "100",
    ]);
    expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "Uso de Visa •••• 1234 en ARS",
      "Uso de Mastercard •••• 9876 en ARS",
      "Uso de Mastercard •••• 9876 en USD",
    ]);
  });

  it("shows no bar for a debit card, which has no cap", () => {
    renderTable();

    const [visa, , debit] = bodyRows();

    expect(
      cellsOf(visa)[7].querySelector("[role='progressbar']"),
    ).not.toBeNull();
    expect(cellsOf(debit)[7].querySelector("[role='progressbar']")).toBeNull();
    expect(cellsOf(debit)[7]).toHaveTextContent("—");
  });

  it("gives the available tier its own icon too, on a cap with room", () => {
    renderTable();

    const [visa] = bodyRows();

    expect(
      cellsOf(visa)[7]
        .querySelector("svg[data-tier]")
        ?.getAttribute("data-tier"),
    ).toBe("available");
  });

  it("names the tier of each cap in words, gives it its icon and colours the bar", () => {
    renderTable();

    const [visa, master] = bodyRows();

    expect(cellsOf(visa)[7]).toHaveTextContent("Disponible");
    expect(cellsOf(master)[7]).toHaveTextContent("Cerca del tope");
    expect(cellsOf(master)[7]).toHaveTextContent("Excedida");
    expect(
      [...cellsOf(master)[7].querySelectorAll("svg[data-tier]")].map((icon) =>
        icon.getAttribute("data-tier"),
      ),
    ).toEqual(["near", "exceeded"]);

    const [first, second, third] = screen.getAllByRole("progressbar");

    expect(first.className).toContain("--positive");
    expect(second.className).toContain("--warning");
    expect(third.className).toContain("--danger");
  });
});

describe("CardsTable column widths", () => {
  it("keeps the Actions column as wide as its two buttons, with the title centered", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: "Acciones" })).toHaveClass(
      "w-[7.25rem]",
      "text-center",
      "px-4",
    );
  });

  it("uses a fixed layout, so a column's width never depends on what is inside it", () => {
    renderTable();

    expect(screen.getByRole("grid")).toHaveClass("table-fixed");
  });

  it("gives the columns that hold short values a width of their own and leaves the card to take the rest", () => {
    renderTable();

    [
      "Tipo",
      "Banco",
      "Cierre",
      "Vencimiento",
      "Tope",
      "Uso",
      "Disponible",
    ].forEach((name) => {
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

    const textCells = Array.from(
      container.querySelectorAll("tbody tr:first-child td"),
    ).slice(1);

    expect(textCells).toHaveLength(8);
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
    ).toEqual([
      "Visa •••• 1234",
      "Mastercard •••• 9876",
      "Mastercard •••• 9999",
    ]);
  });
});

describe("CardsTable headers", () => {
  it("has no sortable header, since the cards come in a fixed order", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");

    expect(headers.length).toBeGreaterThan(0);
    headers.forEach((header) => {
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

  it("shows the whole used-of-cap text of a cap as a tooltip", () => {
    renderTable();

    const used = screen.getByText("$ 75.000,00 de $ 300.000,00");

    expect(used).not.toHaveAttribute("title");
    focusWithKeyboard(used);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "$ 75.000,00 de $ 300.000,00",
    );
  });
});
