// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Bank } from "@/core/banks/types";

import { BankCell } from "./BankCell";

const BANK: Bank = {
  id: "bank_1",
  name: "Banco Galicia",
  kind: "ENTITY",
  archived: false,
};

// Tolerates the ", archivado" suffix; the exact names are pinned in their own test.
const cell = () =>
  screen.getByRole("button", {
    name: /^Editar banco Banco Galicia(, archivado)?$/,
  });
const column = () => cell().parentElement as HTMLElement;

describe("BankCell", () => {
  it("says in its accessible name that the bank is archived, and only then", () => {
    const { rerender } = render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveAccessibleName("Editar banco Banco Galicia");

    rerender(<BankCell bank={{ ...BANK, archived: true }} onEdit={vi.fn()} />);

    expect(
      screen.getByRole("button", {
        name: "Editar banco Banco Galicia, archivado",
      }),
    ).toBeInTheDocument();
  });

  it("shows the name of the bank", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveTextContent("Banco Galicia");
  });

  it("opens the editor of the bank when pressed", () => {
    const onEdit = vi.fn();

    render(<BankCell bank={BANK} onEdit={onEdit} />);
    fireEvent.click(cell());

    expect(onEdit).toHaveBeenCalledWith("bank_1");
  });

  it("marks an archived bank, and only an archived one", () => {
    const { rerender } = render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).not.toHaveTextContent("Archivado");

    rerender(<BankCell bank={{ ...BANK, archived: true }} onEdit={vi.fn()} />);

    expect(cell()).toHaveTextContent("Archivado");
  });

  it("keeps the sticky cell opaque when archived: only the name is dimmed", () => {
    render(<BankCell bank={{ ...BANK, archived: true }} onEdit={vi.fn()} />);

    expect(column()).not.toHaveClass("opacity-60");
    expect(cell()).not.toHaveClass("opacity-60");
    expect(screen.getByText("Banco Galicia")).toHaveClass("opacity-60");
    expect(screen.getByText("Archivado")).not.toHaveClass("opacity-60");
  });

  it("does not dim the name of an active bank", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(screen.getByText("Banco Galicia")).not.toHaveClass("opacity-60");
  });

  it("is narrower on a phone so the cards keep room beside it, and full width from sm up", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    // The sticky column is the button's parent: it carries the width, the padding and the line.
    expect(column()).toHaveClass("w-36", "sm:w-52");
    expect(column()).not.toHaveClass("w-52");
  });

  it("carries the only vertical line of the board, on the right edge of the sticky column", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(column()).toHaveClass("border-r", "border-border");
    expect(column().className).not.toMatch(
      /(^|\s)(border|border-[tbl]|ring-\S+)(\s|$)/,
    );
  });

  it("keeps the sticky column opaque, in theme tokens, with padding around the card", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(column()).toHaveClass(
      "sticky",
      "left-0",
      "z-10",
      "bg-surface",
      "p-3",
      "shrink-0",
    );
    expect(column().className).not.toMatch(/bg-\S+\/\d+/);
    expect(column().className).not.toMatch(/opacity|blue/);
  });

  it("is a card of its own: tinted, rounded, with a border ring, and a visible focus", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveClass(
      "rounded-2xl!",
      "bg-surface-secondary",
      "ring-1",
      "ring-inset",
      "ring-border",
      "min-h-24",
      "hover:bg-surface-tertiary",
      "focus-visible:ring-2",
      "focus-visible:ring-focus",
    );
    expect(cell().className).not.toMatch(/blue|opacity/);
  });

  it("centers its content on both axes, the archived chip right under the name", () => {
    const { rerender } = render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveClass(
      "flex-col",
      "items-center",
      "justify-center",
      "text-center",
    );
    expect(cell().className).not.toMatch(
      /(^|\s)(items-start|justify-between|text-left)(\s|$)/,
    );

    rerender(<BankCell bank={{ ...BANK, archived: true }} onEdit={vi.fn()} />);

    expect(
      Array.from(cell().children).map((child) => child.textContent),
    ).toEqual(["Banco Galicia", "Archivado"]);
  });

  it("opts out of the global button size", () => {
    render(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).toHaveClass(
      "app-button--full-width",
      "app-button--row-height",
    );
  });

  it("marks a virtual wallet with a chip and in its accessible name, and only a wallet", () => {
    const { rerender } = render(
      <BankCell
        bank={{ ...BANK, name: "Mercado Pago", kind: "WALLET" }}
        onEdit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Editar banco Mercado Pago, billetera virtual",
      }),
    ).toHaveTextContent("Billetera");

    rerender(<BankCell bank={BANK} onEdit={vi.fn()} />);

    expect(cell()).not.toHaveTextContent("Billetera");
  });

  it("says both for an archived wallet, with both chips under the name", () => {
    render(
      <BankCell
        bank={{ ...BANK, name: "Mercado Pago", kind: "WALLET", archived: true }}
        onEdit={vi.fn()}
      />,
    );

    const walletCell = screen.getByRole("button", {
      name: "Editar banco Mercado Pago, billetera virtual, archivado",
    });

    expect(
      Array.from(walletCell.children).map((child) => child.textContent),
    ).toEqual(["Mercado Pago", "BilleteraArchivado"]);
  });
});
