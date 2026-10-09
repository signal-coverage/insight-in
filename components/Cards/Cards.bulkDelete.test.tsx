// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  deleteCardAction: vi.fn(),
  deleteCardsAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/core/cards/actions", () => ({
  ...actions,
  createCardAction: vi.fn(),
  updateCardAction: vi.fn(),
}));

import type { BankChoice } from "@/core/banks/types";

import { Cards } from "./Cards";
import { creditCardRow } from "./testRows";
import type { CardRow, CardsTableData } from "./types";

const VISA: CardRow = creditCardRow();

const MASTERCARD: CardRow = creditCardRow({
  id: "card_2",
  last4: "9876",
  brand: "MASTERCARD",
  title: "Mastercard •••• 9876",
  brandName: "Mastercard",
});

const AMEX: CardRow = creditCardRow({
  id: "card_3",
  last4: "0007",
  brand: "OTHER",
  title: "Otra •••• 0007",
  brandName: "Otra",
});

const TABLE: CardsTableData = { rows: [VISA, MASTERCARD, AMEX] };
const BANKS: BankChoice[] = [{ id: "bank_1", name: "Banco Galicia" }];

// The dialog is modal, so while it is open the page behind it is hidden from the accessibility tree.
const HIDDEN = { hidden: true } as const;
const tick = (title: string) =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: `Seleccionar ${title}` }),
  );
const bar = () =>
  screen.queryByRole("region", {
    name: "Acciones para la selección",
    ...HIDDEN,
  });
const rowOf = (title: string) =>
  screen
    .getByRole("rowheader", { name: new RegExp(title), ...HIDDEN })
    .closest("tr") as HTMLElement;
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const openDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

  return screen.findByRole("alertdialog");
};
const confirm = async (dialog: HTMLElement) => {
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
  });
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Cards selection", () => {
  it("shows no bar until a card is selected, then counts them", () => {
    render(<Cards table={TABLE} banks={BANKS} />);

    expect(bar()).not.toBeInTheDocument();

    tick("Visa •••• 1234");
    expect(bar()).toHaveTextContent("1 seleccionada");

    tick("Otra •••• 0007");
    expect(bar()).toHaveTextContent("2 seleccionadas");
  });

  it("selects every card from the header and drops the selection with Quitar selección", () => {
    render(<Cards table={TABLE} banks={BANKS} />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(bar()).toHaveTextContent("3 seleccionadas");

    fireEvent.click(screen.getByRole("button", { name: "Quitar selección" }));

    expect(bar()).not.toBeInTheDocument();
  });

  it("forgets a selected card once the refreshed rows no longer have it", () => {
    const { rerender } = render(<Cards table={TABLE} banks={BANKS} />);

    tick("Otra •••• 0007");
    tick("Visa •••• 1234");
    expect(bar()).toHaveTextContent("2 seleccionadas");

    rerender(<Cards table={{ rows: [VISA, MASTERCARD] }} banks={BANKS} />);

    expect(bar()).toHaveTextContent("1 seleccionada");
  });
});

describe("Cards bulk delete", () => {
  it("asks with the right plural, and deletes nothing until confirmed", async () => {
    render(<Cards table={TABLE} banks={BANKS} />);

    tick("Visa •••• 1234");

    const dialog = await openDialog();

    expect(
      within(dialog).getByText("¿Eliminar 1 tarjeta?"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Esta acción no se puede deshacer."),
    ).toBeInTheDocument();
    expect(actions.deleteCardsAction).not.toHaveBeenCalled();
  });

  it("deletes the selected ids with one call, closes and clears the selection", async () => {
    actions.deleteCardsAction.mockResolvedValue({
      status: "success",
      deleted: 2,
      skipped: 0,
    });
    render(<Cards table={TABLE} banks={BANKS} />);

    tick("Visa •••• 1234");
    tick("Otra •••• 0007");

    const dialog = await openDialog();

    expect(
      within(dialog).getByText("¿Eliminar 2 tarjetas?"),
    ).toBeInTheDocument();

    await confirm(dialog);

    expect(actions.deleteCardsAction).toHaveBeenCalledTimes(1);
    expect(actions.deleteCardsAction).toHaveBeenCalledWith([
      "card_1",
      "card_3",
    ]);
    expect(bar()).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the cards as being deleted, and locks them, until the delete answers", async () => {
    let finish!: (value: {
      status: "success";
      deleted: number;
      skipped: number;
    }) => void;

    actions.deleteCardsAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<Cards table={TABLE} banks={BANKS} />);

    tick("Visa •••• 1234");
    tick("Mastercard •••• 9876");
    await confirm(await openDialog());

    expect(rowOf("Visa")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Mastercard")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Otra")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Visa •••• 1234", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Eliminar Mastercard •••• 9876",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Editar Otra •••• 0007", ...HIDDEN }),
    ).toBeEnabled();

    // A transition that never ends would hold every later one of the file back.
    await act(async () => {
      finish({ status: "success", deleted: 2, skipped: 0 });
    });
  });

  it("gives the cards back, and shows the error, when the delete fails", async () => {
    actions.deleteCardsAction.mockResolvedValue({
      status: "error",
      message: "No se encontraron las tarjetas seleccionadas.",
    });
    render(<Cards table={TABLE} banks={BANKS} />);

    tick("Visa •••• 1234");

    const dialog = await openDialog();

    await confirm(dialog);
    await settle();

    expect(
      within(dialog).getByText("No se encontraron las tarjetas seleccionadas."),
    ).toBeInTheDocument();
    expect(rowOf("Visa")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Visa •••• 1234", ...HIDDEN }),
    ).toBeEnabled();
    expect(bar()).toHaveTextContent("1 seleccionada");
  });

  it("says which cards were left out because they still have pending purchases, and stays open", async () => {
    actions.deleteCardsAction.mockResolvedValue({
      status: "success",
      deleted: 1,
      skipped: 2,
    });
    render(<Cards table={TABLE} banks={BANKS} />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    const dialog = await openDialog();

    await confirm(dialog);
    await settle();

    expect(
      within(dialog).getByText(
        "Se eliminó 1 tarjeta. No se eliminaron 2 tarjetas porque tienen compras pendientes.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("button", { name: "Cerrar" }).length,
    ).toBeGreaterThan(0);
    // Something was deleted, so the selection no longer holds those cards.
    expect(bar()).not.toBeInTheDocument();
    expect(actions.deleteCardsAction).toHaveBeenCalledTimes(1);
  });

  it("explains that nothing was deleted when every card has pending purchases, keeping the selection", async () => {
    actions.deleteCardsAction.mockResolvedValue({
      status: "success",
      deleted: 0,
      skipped: 2,
    });
    render(<Cards table={TABLE} banks={BANKS} />);

    tick("Visa •••• 1234");
    tick("Mastercard •••• 9876");

    const dialog = await openDialog();

    await confirm(dialog);
    await settle();

    expect(
      within(dialog).getByText(
        "No se eliminaron 2 tarjetas porque tienen compras pendientes.",
      ),
    ).toBeInTheDocument();
    expect(rowOf("Visa")).not.toHaveAttribute("data-busy");
    expect(bar()).toHaveTextContent("2 seleccionadas");
  });

  it("uses the singular when a single card was left out", async () => {
    actions.deleteCardsAction.mockResolvedValue({
      status: "success",
      deleted: 0,
      skipped: 1,
    });
    render(<Cards table={TABLE} banks={BANKS} />);

    tick("Visa •••• 1234");

    const dialog = await openDialog();

    await confirm(dialog);

    expect(
      within(dialog).getByText(
        "No se eliminó 1 tarjeta porque tiene compras pendientes.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Cards single delete", () => {
  const confirmSingle = async (title: string) => {
    fireEvent.click(screen.getByRole("button", { name: `Eliminar ${title}` }));

    const dialog = await screen.findByRole("alertdialog");

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    return dialog;
  };

  it("shows the card as being deleted, and not actionable, until the delete answers", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.deleteCardAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<Cards table={TABLE} banks={BANKS} />);

    await confirmSingle("Mastercard •••• 9876");

    expect(rowOf("Mastercard")).toHaveAttribute("data-busy", "true");
    expect(
      screen.getByRole("button", {
        name: "Editar Mastercard •••• 9876",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Eliminar Mastercard •••• 9876",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar Mastercard •••• 9876",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(rowOf("Visa")).not.toHaveAttribute("data-busy");

    await act(async () => {
      finish({ status: "success" });
    });
  });

  it("gives the card back, and shows the error, when the delete fails", async () => {
    actions.deleteCardAction.mockResolvedValue({
      status: "error",
      message: "Esta tarjeta tiene gastos pendientes.",
    });
    render(<Cards table={TABLE} banks={BANKS} />);

    const dialog = await confirmSingle("Mastercard •••• 9876");

    await settle();

    expect(
      within(dialog).getByText("Esta tarjeta tiene gastos pendientes."),
    ).toBeInTheDocument();
    expect(rowOf("Mastercard")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", {
        name: "Editar Mastercard •••• 9876",
        ...HIDDEN,
      }),
    ).toBeEnabled();
  });
});
