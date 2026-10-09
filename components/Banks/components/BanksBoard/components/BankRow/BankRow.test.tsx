// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BoardBank } from "@/core/banks/types";

import { BankRow } from "./BankRow";

const BANK: BoardBank = {
  id: "bank_1",
  name: "Banco Galicia",
  kind: "ENTITY",
  archived: false,
  accounts: [
    {
      id: "acc_1",
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
      archived: false,
      balance: 0,
      balanceLabel: "$ 0,00",
      hasMovements: false,
    },
    {
      id: "acc_2",
      bankId: "bank_1",
      name: "Cuenta en dólares",
      currency: "USD",
      archived: false,
      balance: 0,
      balanceLabel: "$ 0,00",
      hasMovements: false,
    },
  ],
};

const renderRow = (bank: BoardBank = BANK) => {
  const handlers = {
    onEditBank: vi.fn(),
    onEditAccount: vi.fn(),
    onAddAccount: vi.fn(),
  };

  render(
    <ul>
      <BankRow bank={bank} {...handlers} />
    </ul>,
  );

  return handlers;
};

const tilesList = (bankName = "Banco Galicia") =>
  screen.getByRole("list", { name: `Cuentas de ${bankName}` });

describe("BankRow", () => {
  it("starts with the bank, then one tile per account in the order given, then '+ Nueva cuenta'", () => {
    renderRow();

    expect(
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
    ).toBeInTheDocument();
    expect(
      within(tilesList())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar cuenta Caja de ahorro, ARS, saldo $ 0,00",
      "Editar cuenta Cuenta en dólares, USD, saldo $ 0,00",
      "+ Nueva cuenta en Banco Galicia",
    ]);
  });

  it("shows each account's balance in its tile, between the name and the currency", () => {
    renderRow();

    expect(
      screen.getByRole("button", {
        name: "Editar cuenta Cuenta en dólares, USD, saldo $ 0,00",
      }),
    ).toHaveTextContent(/^Cuenta en dólares\$ 0,00USD$/);
  });

  it("offers only '+ Nueva cuenta' for a bank without accounts", () => {
    renderRow({ ...BANK, accounts: [] });

    expect(
      within(tilesList())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["+ Nueva cuenta en Banco Galicia"]);
  });

  it("offers no '+ Nueva cuenta' for an archived bank: nothing can be added to it", () => {
    renderRow({ ...BANK, archived: true });

    expect(
      screen.queryByRole("button", { name: "+ Nueva cuenta en Banco Galicia" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Editar cuenta Caja de ahorro, ARS, saldo $ 0,00",
      }),
    ).toBeInTheDocument();
  });

  it("lays the account cards side by side with a gap and padding around them, and no divider", () => {
    renderRow();

    const accounts = tilesList();

    expect(accounts).toHaveClass("flex", "items-stretch", "gap-3", "p-3");
    expect(accounts.className).not.toMatch(/(^|\s)(divide-|border|ring|bg-)/);
    for (const item of within(accounts).getAllByRole("listitem")) {
      expect(item.className).not.toMatch(/(^|\s)(gap-|border|ring|bg-)/);
    }
  });

  it("is a row of the board: cards stretched to the row, about 120px tall, no gap in the row itself", () => {
    renderRow();

    const row = screen.getAllByRole("listitem")[0];

    expect(row).toHaveClass("flex", "min-h-30", "items-stretch");
    expect(row.className).not.toMatch(/(^|\s)gap-/);
  });

  it("gives the bank card, the account cards and the add card the same minimum height", () => {
    renderRow();

    const cards = [
      screen.getByRole("button", { name: "Editar banco Banco Galicia" }),
      ...within(tilesList()).getAllByRole("button"),
    ];

    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card).toHaveClass("min-h-24");
    }
  });

  it("reports the bank, the account and the bank to add to", () => {
    const { onEditBank, onEditAccount, onAddAccount } = renderRow();

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

    expect(onEditBank).toHaveBeenCalledWith("bank_1");
    expect(onEditAccount).toHaveBeenCalledWith(BANK.accounts[0]);
    expect(onAddAccount).toHaveBeenCalledWith("bank_1");
  });
});
