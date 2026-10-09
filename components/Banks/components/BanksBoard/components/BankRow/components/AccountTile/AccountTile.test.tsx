// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BoardAccount } from "@/core/banks/types";

import { AccountTile } from "./AccountTile";

const ACCOUNT: BoardAccount = {
  id: "acc_1",
  bankId: "bank_1",
  name: "Caja de ahorro",
  currency: "ARS",
  archived: false,
  balance: 150000,
  balanceLabel: "$ 1.500,00",
  hasMovements: true,
};

const tile = (name = "Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00") =>
  screen.getByRole("button", { name });

describe("AccountTile", () => {
  it("names the button after the account, its currency and its balance", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveAccessibleName(
      "Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00",
    );

    render(
      <AccountTile
        account={{ ...ACCOUNT, name: "Cuenta en dólares", currency: "USD" }}
        onEdit={vi.fn()}
      />,
    );

    expect(
      tile("Editar cuenta Cuenta en dólares, USD, saldo $ 1.500,00"),
    ).toBeInTheDocument();
  });

  it("says in its accessible name that the account is archived", () => {
    render(
      <AccountTile account={{ ...ACCOUNT, archived: true }} onEdit={vi.fn()} />,
    );

    expect(
      tile("Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00, archivada"),
    ).toBeInTheDocument();
  });

  it("shows the name, the balance and the currency of the account", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveTextContent(/^Caja de ahorro\$ 1\.500,00ARS$/);
  });

  it("shows a negative balance in red, and a positive one in the usual color", () => {
    const { rerender } = render(
      <AccountTile account={ACCOUNT} onEdit={vi.fn()} />,
    );

    expect(screen.getByText("$ 1.500,00")).not.toHaveClass("text-danger");

    rerender(
      <AccountTile
        account={{ ...ACCOUNT, balance: -2550, balanceLabel: "-$ 25,50" }}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("-$ 25,50")).toHaveClass("text-danger");
  });

  it("opens the editor of the account when pressed", () => {
    const onEdit = vi.fn();

    render(<AccountTile account={ACCOUNT} onEdit={onEdit} />);
    fireEvent.click(tile());

    expect(onEdit).toHaveBeenCalledWith(ACCOUNT);
  });

  it("marks an archived account", () => {
    render(
      <AccountTile account={{ ...ACCOUNT, archived: true }} onEdit={vi.fn()} />,
    );

    expect(
      tile("Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00, archivada"),
    ).toHaveTextContent("Archivada");
  });

  it("does not mark an active account as archived", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).not.toHaveTextContent("Archivada");
  });

  it("is a card: tinted, rounded, with a border ring and no vertical line of its own", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveClass(
      "rounded-2xl!",
      "bg-surface-secondary",
      "ring-1",
      "ring-inset",
      "ring-border",
    );
    expect(tile().className).not.toMatch(
      /(^|\s)(border|border-\S+|border-[rl])(\s|$)/,
    );
    expect(tile().className).not.toMatch(/blue/);
  });

  it("still reads as clickable: hover and a visible focus ring", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveClass(
      "hover:bg-surface-tertiary",
      "focus-visible:ring-2",
      "focus-visible:ring-focus",
    );
  });

  it("puts the name at the top-left, the balance under it and the currency at the bottom-right", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    const [name, balance, bottom] = Array.from(tile().children);

    expect(tile()).toHaveClass("flex-col", "items-start", "justify-between");
    expect(name).toHaveTextContent("Caja de ahorro");
    expect(balance).toHaveTextContent("$ 1.500,00");
    expect(bottom).toHaveClass(
      "flex",
      "w-full",
      "items-center",
      "justify-between",
    );
    expect(bottom.children).toHaveLength(1);
    expect(bottom.children[0]).toHaveClass("ml-auto");
    expect(bottom.children[0]).toHaveTextContent("ARS");
  });

  it("puts the archived chip at the bottom-left, before the currency", () => {
    render(
      <AccountTile account={{ ...ACCOUNT, archived: true }} onEdit={vi.fn()} />,
    );

    const bottom = tile(
      "Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00, archivada",
    ).children[2];

    expect(
      Array.from(bottom.children).map((child) => child.textContent),
    ).toEqual(["Archivada", "ARS"]);
    expect(bottom.children[1]).toHaveClass("ml-auto");
  });

  it("never clips its three rows: the name is one line that truncates sideways, the rows do not shrink", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    const [name, balance, bottom] = Array.from(tile().children);

    expect(name).toHaveClass("shrink-0", "truncate", "leading-5");
    expect(name.className).not.toMatch(
      /(^|\s)(line-clamp-\S+|overflow-hidden|overflow-y-\S+|min-h-0)(\s|$)/,
    );
    expect(balance).toHaveClass("shrink-0", "leading-5");
    expect(bottom).toHaveClass("shrink-0");
    expect(tile()).toHaveClass("gap-1");
  });

  it("keeps its width and the row height, and dims only when archived", () => {
    const { rerender } = render(
      <AccountTile account={ACCOUNT} onEdit={vi.fn()} />,
    );

    expect(tile()).toHaveClass("w-44", "min-h-24", "shrink-0");
    expect(tile()).not.toHaveClass("opacity-60");

    rerender(
      <AccountTile account={{ ...ACCOUNT, archived: true }} onEdit={vi.fn()} />,
    );

    expect(
      tile("Editar cuenta Caja de ahorro, ARS, saldo $ 1.500,00, archivada"),
    ).toHaveClass("opacity-60");
  });

  it("opts out of the global button size so the tile keeps its own, and is a plain button", () => {
    render(<AccountTile account={ACCOUNT} onEdit={vi.fn()} />);

    expect(tile()).toHaveAttribute("type", "button");
    expect(tile()).toHaveClass(
      "app-button--full-width",
      "app-button--row-height",
    );
  });
});
