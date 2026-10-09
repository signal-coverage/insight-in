// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BoardBank } from "@/core/banks/types";

import { BanksBoard } from "./BanksBoard";

const BANKS: BoardBank[] = [
  {
    id: "cash",
    name: "Efectivo",
    kind: "ENTITY",
    archived: false,
    accounts: [
      {
        id: "cash_ars",
        bankId: "cash",
        name: "Efectivo",
        currency: "ARS",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
    ],
  },
  {
    id: "galicia",
    name: "Banco Galicia",
    kind: "ENTITY",
    archived: false,
    accounts: [
      {
        id: "gal_sav",
        bankId: "galicia",
        name: "Caja de ahorro",
        currency: "ARS",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
      {
        id: "gal_usd",
        bankId: "galicia",
        name: "Cuenta en dólares",
        currency: "USD",
        archived: false,
        balance: 0,
        balanceLabel: "$ 0,00",
        hasMovements: false,
      },
    ],
  },
];

// The rows of the banks, without the "+ Nuevo banco" row that closes the list.
const bankRows = () =>
  within(screen.getByRole("list", { name: "Bancos y cuentas" }))
    .getAllByRole("listitem")
    .filter(
      (item) =>
        item.parentElement?.getAttribute("aria-label") === "Bancos y cuentas" &&
        within(item).queryByRole("button", { name: /^Editar banco / }) !== null,
    );

const renderBoard = (
  banks: BoardBank[] = BANKS,
  isSearching = false,
  hasArchivedBanks = false,
) => {
  const handlers = {
    onEditBank: vi.fn(),
    onEditAccount: vi.fn(),
    onAddAccount: vi.fn(),
    onAddBank: vi.fn(),
  };

  render(
    <BanksBoard
      banks={banks}
      isSearching={isSearching}
      hasArchivedBanks={hasArchivedBanks}
      {...handlers}
    />,
  );

  return handlers;
};

describe("BanksBoard", () => {
  it("shows one row per bank, in the order given, the bank first", () => {
    renderBoard();

    expect(
      screen
        .getAllByRole("button", { name: /^Editar banco / })
        .map((button) => button.textContent),
    ).toEqual(["Efectivo", "Banco Galicia"]);
  });

  it("shows the accounts of each bank in its own row, with '+ Nueva cuenta' last", () => {
    renderBoard();

    expect(
      within(screen.getByRole("list", { name: "Cuentas de Banco Galicia" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar cuenta Caja de ahorro, ARS, saldo $ 0,00",
      "Editar cuenta Cuenta en dólares, USD, saldo $ 0,00",
      "+ Nueva cuenta en Banco Galicia",
    ]);
    expect(
      within(screen.getByRole("list", { name: "Cuentas de Efectivo" }))
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar cuenta Efectivo, ARS, saldo $ 0,00",
      "+ Nueva cuenta en Efectivo",
    ]);
  });

  it("scrolls inside its own box, sideways and up and down, so the page never scrolls", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "overflow-auto",
    );
  });

  it("keeps a focused card clear of the sticky bank column, on a phone and from sm up", () => {
    renderBoard();

    // The sticky column is 9rem (13rem from sm up) wide, padding and border included, and the cards
    // start 0.75rem (the padding of the account area) after it: 9.75rem and 13.75rem.
    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "scroll-pl-39",
      "sm:scroll-pl-55",
    );
  });

  it("fills the height under the toolbar like the other tables, with a floor", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "flex-1",
      "min-h-64",
      "min-w-0",
    );
  });

  it("keeps the rows at the top at their own height: the free space is empty container", () => {
    renderBoard();

    const board = screen.getByRole("list", { name: "Bancos y cuentas" });

    expect(board).toHaveClass("content-start");
    expect(board.className).not.toMatch(/(^|\s)(content-stretch|grid-rows-)/);
    for (const row of within(board)
      .getAllByRole("listitem")
      .filter((item) => item.parentElement === board)) {
      expect(row.className).not.toMatch(
        /(^|\s)(h-full|h-\S+|flex-1|grow|self-stretch)(\s|$)/,
      );
    }
  });

  it("is one bordered, rounded container like the data tables, in theme tokens only", () => {
    renderBoard();

    const board = screen.getByRole("list", { name: "Bancos y cuentas" });

    expect(board).toHaveClass(
      "rounded-2xl",
      "border",
      "border-border",
      "bg-surface",
      "overflow-auto",
    );
    expect(board.className).not.toMatch(/blue/);
  });

  it("separates the rows with a horizontal line and leaves no gap between them", () => {
    renderBoard();

    const board = screen.getByRole("list", { name: "Bancos y cuentas" });

    expect(board).toHaveClass("divide-y", "divide-border");
    expect(board.className).not.toMatch(/(^|\s)gap-/);
  });

  it("makes every row as wide as the widest one, so the lines span the whole scroll width", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "grid",
      "grid-cols-[minmax(max-content,1fr)]",
    );
  });

  it("gives every bank row the same minimum height and no card of its own", () => {
    renderBoard();

    expect(bankRows()).toHaveLength(2);
    for (const row of bankRows()) {
      expect(row).toHaveClass("min-h-30", "items-stretch");
      expect(row.className).not.toMatch(/(^|\s)(gap-|border|ring|bg-)/);
    }
  });

  it("has only the bank rows and the new-bank row: no filler, so the column line stops at the last bank", () => {
    renderBoard();

    const board = screen.getByRole("list", { name: "Bancos y cuentas" });

    expect(board.children).toHaveLength(3);
    expect(Array.from(board.children).slice(0, 2)).toEqual(bankRows());
    expect(board.querySelector("[aria-hidden='true']")).toBeNull();
    expect(board.getAttribute("style")).toBeNull();
  });

  it("closes the list with the '+ Nuevo banco' row, a real list item that reports onAddBank", () => {
    const { onAddBank } = renderBoard();

    const board = screen.getByRole("list", { name: "Bancos y cuentas" });
    const row = board.lastElementChild as HTMLElement;
    const add = within(row).getByRole("button", { name: "+ Nuevo banco" });

    expect(row.tagName).toBe("LI");
    expect(screen.getAllByRole("listitem")).toContain(row);
    expect(row).not.toHaveAttribute("aria-hidden");

    fireEvent.click(add);

    expect(onAddBank).toHaveBeenCalledTimes(1);
  });

  it("measures the visible width of the board for that row", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "@container",
    );
  });

  it("offers no '+ Nuevo banco' when there is nothing to show", () => {
    renderBoard([]);

    expect(screen.queryByRole("button", { name: "+ Nuevo banco" })).toBeNull();
  });

  it("draws the container only when there are rows", () => {
    const { rerender } = render(
      <BanksBoard
        banks={BANKS}
        isSearching={false}
        hasArchivedBanks={false}
        onEditBank={vi.fn()}
        onEditAccount={vi.fn()}
        onAddAccount={vi.fn()}
        onAddBank={vi.fn()}
      />,
    );

    expect(screen.getByRole("list", { name: "Bancos y cuentas" })).toHaveClass(
      "border",
    );

    rerender(
      <BanksBoard
        banks={[]}
        isSearching={false}
        hasArchivedBanks={false}
        onEditBank={vi.fn()}
        onEditAccount={vi.fn()}
        onAddAccount={vi.fn()}
        onAddBank={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).not.toHaveClass("border");
    expect(document.querySelector(".border")).toBeNull();
  });

  it("reports the bank, the account and the bank to add to", () => {
    const { onEditBank, onEditAccount, onAddAccount } = renderBoard();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar cuenta Caja de ahorro, ARS, saldo $ 0,00",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    );

    expect(onEditBank).toHaveBeenCalledWith("galicia");
    expect(onEditAccount).toHaveBeenCalledWith(BANKS[1].accounts[0]);
    expect(onAddAccount).toHaveBeenCalledWith("galicia");
  });

  it("says there is nothing to show when there are no banks", () => {
    renderBoard([]);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No hay bancos para mostrar. Creá uno desde el menú Acciones.",
    );
    expect(screen.queryByRole("list", { name: "Bancos y cuentas" })).toBeNull();
  });

  it("points to the archived toggle when every bank is archived and hidden", () => {
    renderBoard([], false, true);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Todos tus bancos están archivados. Activá «Mostrar archivados» para verlos.",
    );
  });

  it("keeps the search message while searching, even if some banks are archived", () => {
    renderBoard([], true, true);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ningún banco ni cuenta coincide con la búsqueda.",
    );
  });

  it("says nothing matched while a search is active", () => {
    renderBoard([], true);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ningún banco ni cuenta coincide con la búsqueda.",
    );
  });
});
