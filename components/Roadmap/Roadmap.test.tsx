// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/roadmap/actions", () => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  moveItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
}));

import { deleteItemAction } from "@/core/roadmap/actions";
import type { BoardColumns } from "@/core/roadmap/types";

import { Roadmap } from "./Roadmap";

const COLUMNS: BoardColumns = {
  IDEA: [
    {
      id: "a",
      title: "Modo oscuro",
      description: "Para usarla de noche",
      status: "IDEA",
      position: 1024,
      createdAt: "2026-10-04",
    },
  ],
  TODO: [],
  DONE: [],
  DEPLOYED: [],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Roadmap page", () => {
  it("shows the title and what the page is for", () => {
    render(<Roadmap board={COLUMNS} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Hoja de ruta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ideas y tareas de la app, desde que se piensan hasta que están en producción.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the header and the skeleton columns while the board loads", () => {
    render(<Roadmap board={new Promise(() => {})} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Hoja de ruta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva idea" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Cargando la hoja de ruta" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Ideas" })).toBeNull();
  });

  it("shows the board once its promise resolves", async () => {
    // Settled before it renders, inside act: the case jsdom can drive (see Await.test.tsx).
    const data = Promise.resolve(COLUMNS);

    await act(async () => {
      render(<Roadmap board={data} />);
    });

    expect(await screen.findByText("Modo oscuro")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Cargando la hoja de ruta" }),
    ).toBeNull();
  });

  it("opens an empty form for a new idea from the header button", async () => {
    render(<Roadmap board={COLUMNS} />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva idea" }));

    expect(
      await screen.findByRole("heading", { name: "Nueva tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Se agrega a Ideas.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Título/ })).toHaveValue("");
  });

  it("opens the form for the column whose plus was pressed", async () => {
    render(<Roadmap board={COLUMNS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar una tarjeta a Hechas" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Nueva tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Se agrega a Hechas.")).toBeInTheDocument();
  });

  it("opens the form with the text of the card to edit it", async () => {
    render(<Roadmap board={COLUMNS} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar Modo oscuro" }));

    expect(
      await screen.findByRole("heading", { name: "Editar tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Título/ })).toHaveValue(
      "Modo oscuro",
    );
    expect(screen.getByRole("textbox", { name: /Descripción/ })).toHaveValue(
      "Para usarla de noche",
    );
  });

  it("asks for confirmation before deleting, and deletes the card on confirm", async () => {
    vi.mocked(deleteItemAction).mockResolvedValue({ status: "success" });
    render(<Roadmap board={COLUMNS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Modo oscuro" }),
    );

    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText('¿Eliminar la tarjeta "Modo oscuro"?'),
    ).toBeInTheDocument();
    expect(deleteItemAction).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    expect(deleteItemAction).toHaveBeenCalledWith("a");
  });
});
