// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ moveItemAction: vi.fn() }));

vi.mock("@/core/roadmap/actions", () => actions);

import type { BoardColumns, BoardItem } from "@/core/roadmap/types";

import { Board } from "./Board";

const item = (
  id: string,
  title: string,
  status: BoardItem["status"],
  patch: Partial<BoardItem> = {},
): BoardItem => ({
  id,
  title,
  description: null,
  status,
  position: 1024,
  createdAt: "2026-10-04",
  ...patch,
});

const COLUMNS: BoardColumns = {
  IDEA: [
    item("a", "Modo oscuro", "IDEA", { description: "Para usarla de noche" }),
    item("b", "Exportar a Excel", "IDEA"),
  ],
  TODO: [item("c", "Filtros por tarjeta", "TODO")],
  DONE: [],
  DEPLOYED: [],
};

const renderBoard = (columns: BoardColumns = COLUMNS) => {
  const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };

  render(<Board columns={columns} {...handlers} />);

  return handlers;
};

const column = (title: string) => screen.getByRole("region", { name: title });
// The title of every card of a column, in order. The empty hint is a row of the list too, but it has
// no heading.
const titlesOf = (title: string) =>
  within(column(title))
    .queryAllByRole("row")
    .flatMap((row) => within(row).queryAllByRole("heading"))
    .map((heading) => heading.textContent);

const openMoveMenu = async (cardTitle: string) => {
  fireEvent.click(
    screen.getByRole("button", { name: `Mover ${cardTitle} a…` }),
  );

  return screen.findByRole("menu");
};

const moveTo = async (cardTitle: string, columnTitle: string) => {
  await openMoveMenu(cardTitle);

  // The move is a transition that goes on after the press: act waits for the save to settle.
  await act(async () => {
    fireEvent.keyDown(screen.getByRole("menuitem", { name: columnTitle }), {
      key: "Enter",
    });
  });
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Board", () => {
  it("shows the four columns in order, each with its title", () => {
    renderBoard();

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Ideas", "Pendientes", "Hechas", "En producción"]);
  });

  it("shows how many cards each column holds", () => {
    renderBoard();

    expect(within(column("Ideas")).getByText("2")).toBeInTheDocument();
    expect(within(column("Pendientes")).getByText("1")).toBeInTheDocument();
    expect(within(column("Hechas")).getByText("0")).toBeInTheDocument();
  });

  it("shows the cards of each column, in order", () => {
    renderBoard();

    expect(titlesOf("Ideas")).toEqual(["Modo oscuro", "Exportar a Excel"]);
    expect(titlesOf("Pendientes")).toEqual(["Filtros por tarjeta"]);
  });

  it("shows the description and the creation date of a card", () => {
    renderBoard();

    expect(screen.getByText("Para usarla de noche")).toBeInTheDocument();
    expect(screen.getAllByText(/Creada el 4 oct 2026/)).toHaveLength(3);
  });

  it("gives an empty column a hint to drop a card there", () => {
    renderBoard();

    expect(
      within(column("Hechas")).getByText("Arrastrá una tarjeta acá"),
    ).toBeInTheDocument();
    expect(
      within(column("En producción")).getByText("Arrastrá una tarjeta acá"),
    ).toBeInTheDocument();
    expect(
      within(column("Ideas")).queryByText("Arrastrá una tarjeta acá"),
    ).toBeNull();
  });

  it("asks for a new card in the column whose plus was pressed", () => {
    const { onAdd } = renderBoard();

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar una tarjeta a Pendientes" }),
    );

    expect(onAdd).toHaveBeenCalledWith("TODO");
  });

  it("asks to edit and to delete the card whose button was pressed", () => {
    const { onEdit, onDelete } = renderBoard();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Exportar a Excel" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Exportar a Excel" }),
    );

    expect(onEdit).toHaveBeenCalledWith(COLUMNS.IDEA[1]);
    expect(onDelete).toHaveBeenCalledWith(COLUMNS.IDEA[1]);
  });

  it("styles the delete button as the destructive one", () => {
    renderBoard();

    expect(
      screen.getByRole("button", { name: "Eliminar Modo oscuro" }).className,
    ).toMatch(/danger/);
  });
});

describe("Mover a…", () => {
  it("offers every column but the one the card is in", async () => {
    renderBoard();

    await openMoveMenu("Modo oscuro");

    expect(
      screen.getAllByRole("menuitem").map((entry) => entry.textContent),
    ).toEqual(["Ideas", "Pendientes", "Hechas", "En producción"]);
    expect(screen.getByRole("menuitem", { name: "Ideas" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("menuitem", { name: "Pendientes" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("moves the card to the end of the column picked, through the action", async () => {
    actions.moveItemAction.mockResolvedValue({ status: "success" });
    renderBoard();

    await moveTo("Modo oscuro", "Pendientes");

    await waitFor(() =>
      expect(actions.moveItemAction).toHaveBeenCalledWith({
        id: "a",
        status: "TODO",
        index: 1,
      }),
    );
  });

  it("puts the card in its new column at once, before the server answers", async () => {
    // Answers only when the test says so: until then the card must already be where it was moved to.
    let answer!: (value: { status: "success" }) => void;

    actions.moveItemAction.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderBoard();

    await moveTo("Modo oscuro", "Hechas");

    await waitFor(() => expect(titlesOf("Hechas")).toEqual(["Modo oscuro"]));
    expect(titlesOf("Ideas")).toEqual(["Exportar a Excel"]);
    expect(
      within(column("Hechas")).queryByText("Arrastrá una tarjeta acá"),
    ).toBeNull();
    expect(within(column("Hechas")).getByText("1")).toBeInTheDocument();

    // A transition that never ends would hold back the ones of the next tests.
    await act(async () => answer({ status: "success" }));
  });

  it("puts the card back and says why when the server refuses the move", async () => {
    actions.moveItemAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    renderBoard();

    await moveTo("Modo oscuro", "Hechas");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró la tarjeta.",
    );
    await waitFor(() =>
      expect(titlesOf("Ideas")).toEqual(["Modo oscuro", "Exportar a Excel"]),
    );
    expect(titlesOf("Hechas")).toEqual([]);
  });

  it("puts the card back and shows a generic error when the action throws", async () => {
    actions.moveItemAction.mockRejectedValue(new Error("network down"));
    renderBoard();

    await moveTo("Modo oscuro", "Hechas");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
    await waitFor(() =>
      expect(titlesOf("Ideas")).toEqual(["Modo oscuro", "Exportar a Excel"]),
    );
  });

  it("clears an earlier error when the next move is made", async () => {
    actions.moveItemAction
      .mockResolvedValueOnce({ status: "error", message: "Falló." })
      .mockResolvedValueOnce({ status: "success" });
    renderBoard();

    await moveTo("Modo oscuro", "Hechas");
    expect(await screen.findByRole("alert")).toHaveTextContent("Falló.");
    await waitFor(() => expect(titlesOf("Hechas")).toEqual([]));

    await moveTo("Exportar a Excel", "Hechas");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
