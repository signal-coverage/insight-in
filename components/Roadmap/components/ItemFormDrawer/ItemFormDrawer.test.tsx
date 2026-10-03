// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
}));

vi.mock("@/core/roadmap/actions", () => actions);

import type { BoardItem } from "@/core/roadmap/types";

import type { FormTarget } from "../../types";
import { ItemFormDrawer } from "./ItemFormDrawer";

const ITEM: BoardItem = {
  id: "item_1",
  title: "Modo oscuro",
  description: "Para usarla de noche",
  status: "TODO",
  position: 1024,
  createdAt: "2026-10-04",
};

const renderForm = (target: FormTarget) => {
  const onClose = vi.fn();

  render(
    <ItemFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
    />,
  );

  return { onClose };
};

const CREATE_IDEA: FormTarget = { key: 1, status: "IDEA", item: null };

const titleInput = () => screen.getByRole("textbox", { name: /Título/ });
const descriptionInput = () =>
  screen.getByRole("textbox", { name: /Descripción/ });

const sentForm = (action: ReturnType<typeof vi.fn>, call = 0): FormData =>
  action.mock.calls[0][call] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("is titled 'Nueva tarjeta' and says which column it goes to", () => {
    renderForm({ key: 1, status: "DONE", item: null });

    expect(
      screen.getByRole("heading", { name: "Nueva tarjeta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Se agrega a Hechas.")).toBeInTheDocument();
  });

  it("has an add button with the plus icon, and a Cancel", () => {
    renderForm(CREATE_IDEA);

    const button = screen.getByRole("button", { name: "Agregar tarjeta" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("limits the title to 120 characters and the description to 1000", () => {
    renderForm(CREATE_IDEA);

    expect(titleInput()).toHaveAttribute("maxlength", "120");
    expect(descriptionInput()).toHaveAttribute("maxlength", "1000");
  });

  it("sends the title, the description and the column through the create action, and closes", async () => {
    actions.createItemAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm({ key: 1, status: "TODO", item: null });

    fireEvent.change(titleInput(), { target: { value: "Exportar a Excel" } });
    fireEvent.change(descriptionInput(), { target: { value: "Gastos" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const form = sentForm(actions.createItemAction);

    expect(form.get("title")).toBe("Exportar a Excel");
    expect(form.get("description")).toBe("Gastos");
    expect(form.get("status")).toBe("TODO");
    expect(actions.updateItemAction).not.toHaveBeenCalled();
  });

  it("shows 'Agregando…' with a spinner and locks Cancel while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.createItemAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderForm(CREATE_IDEA);

    fireEvent.change(titleInput(), { target: { value: "Algo" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    const pending = await screen.findByRole("button", { name: /Agregando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the errors of the fields the server refused, and stays open", async () => {
    actions.createItemAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { title: ["El título es obligatorio."] },
    });
    const { onClose } = renderForm(CREATE_IDEA);

    fireEvent.change(titleInput(), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    expect(
      await screen.findByText("El título es obligatorio."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a failure that belongs to no field as an alert", async () => {
    actions.createItemAction.mockResolvedValue({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    renderForm(CREATE_IDEA);

    fireEvent.change(titleInput(), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar tarjeta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo salió mal. Inténtalo de nuevo.",
    );
  });
});

describe("edit mode", () => {
  it("is titled 'Editar tarjeta' and starts with the text of the card", () => {
    renderForm({ key: 2, status: ITEM.status, item: ITEM });

    expect(
      screen.getByRole("heading", { name: "Editar tarjeta" }),
    ).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Modo oscuro");
    expect(descriptionInput()).toHaveValue("Para usarla de noche");
  });

  it("saves through the update action with the id of the card, and never sends a column", async () => {
    actions.updateItemAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm({ key: 2, status: ITEM.status, item: ITEM });

    fireEvent.change(titleInput(), { target: { value: "Tema oscuro" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateItemAction.mock.calls[0][0]).toBe("item_1");

    const form = sentForm(actions.updateItemAction, 1);

    expect(form.get("title")).toBe("Tema oscuro");
    expect(form.has("status")).toBe(false);
    expect(actions.createItemAction).not.toHaveBeenCalled();
  });

  it("starts with an empty description for a card that has none", () => {
    renderForm({
      key: 3,
      status: "IDEA",
      item: { ...ITEM, description: null },
    });

    expect(descriptionInput()).toHaveValue("");
  });
});
