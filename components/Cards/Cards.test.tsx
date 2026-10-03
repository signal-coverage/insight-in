// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/cards/actions", () => ({
  createCardAction: vi.fn(),
  updateCardAction: vi.fn(),
  deleteCardAction: vi.fn(),
  deleteCardsAction: vi.fn(),
}));

import { Cards } from "./Cards";
import type { CardRow, CardsTableData } from "./types";

const ROW: CardRow = {
  id: "card_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
  committedTotal: 0,
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

const WITH_CARDS: CardsTableData = { rows: [ROW] };
const NO_CARDS: CardsTableData = { rows: [] };

const NOTE =
  "El tope puede ser el límite real de la tarjeta o uno menor que quieras respetar.";

const trigger = () => screen.getByRole("button", { name: "Acciones" });

const openMenu = () => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  return screen.findByRole("menu");
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Cards page", () => {
  it("shows the title and what the page is for", () => {
    render(<Cards table={WITH_CARDS} />);

    expect(
      screen.getByRole("heading", { name: "Tarjetas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tus tarjetas de crédito y cuánto querés destinarles."),
    ).toBeInTheDocument();
  });

  it("offers Agregar tarjeta and the icon help in the Actions menu, and nothing else", async () => {
    render(<Cards table={WITH_CARDS} />);

    await openMenu();

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Agregar tarjeta", "Ayuda de íconos"]);
  });

  it("takes the user to the help page from Ayuda de íconos", async () => {
    render(<Cards table={WITH_CARDS} />);

    await openMenu();

    const item = screen.getByRole("menuitem", { name: "Ayuda de íconos" });

    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyUp(item, { key: "Enter" });

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/help");
  });

  it("lists the cards in the table", () => {
    render(<Cards table={WITH_CARDS} />);

    expect(screen.getByText("Visa •••• 1234")).toBeInTheDocument();
    expect(screen.getByText("$ 300.000,00 por mes")).toBeInTheDocument();
  });

  it("says under the table that the cap can be the real limit or a lower one", () => {
    render(<Cards table={WITH_CARDS} />);

    const note = screen.getByText(NOTE);
    const table = screen.getByRole("grid");

    expect(
      table.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("invites the user to add the first card when there are none, without the note", () => {
    render(<Cards table={NO_CARDS} />);

    expect(screen.getByText("Todavía no tenés tarjetas")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Agregar tarjeta" }),
    ).toHaveLength(1);
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it("opens the form to add a card from the empty state", async () => {
    render(<Cards table={NO_CARDS} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    expect(
      await screen.findByRole("heading", { name: "Agregar tarjeta" }),
    ).toBeInTheDocument();
  });

  it("opens the form to add a card from the Actions menu", async () => {
    render(<Cards table={WITH_CARDS} />);

    await openMenu();

    const item = screen.getByRole("menuitem", { name: "Agregar tarjeta" });

    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyUp(item, { key: "Enter" });

    expect(
      await screen.findByRole("heading", { name: "Agregar tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Visa" })).toBeChecked();
  });

  it("opens the form with the card's data to edit it", async () => {
    render(<Cards table={WITH_CARDS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Visa •••• 1234" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Editar tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Monto del tope/ })).toHaveValue(
      "300000.00",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before deleting a card, naming it", async () => {
    render(<Cards table={WITH_CARDS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Visa •••• 1234" }),
    );

    expect(
      await screen.findByText("¿Eliminar la tarjeta Visa •••• 1234?"),
    ).toBeInTheDocument();
  });
});

describe("Cards page while the data is on its way", () => {
  it("shows its structure at once, with the table as a skeleton", () => {
    render(<Cards table={new Promise(() => {})} />);

    expect(
      screen.getByRole("heading", { name: "Tarjetas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tarjetas");
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it("fills the table in once the cards arrive", async () => {
    // Settled before it renders, inside act: the case jsdom can drive (see Await.test.tsx).
    const data = Promise.resolve(WITH_CARDS);

    await act(async () => {
      render(<Cards table={data} />);
    });

    expect(await screen.findByText("Visa •••• 1234")).toBeInTheDocument();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });
});
