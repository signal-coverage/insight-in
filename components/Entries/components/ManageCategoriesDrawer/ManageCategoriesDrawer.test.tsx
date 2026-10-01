// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = {
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
};

import { ManageCategoriesDrawer } from "./ManageCategoriesDrawer";

const CATEGORIES = [
  { id: "c2", name: "Salary", count: 3 },
  { id: "c1", name: "Gifts", count: 0 },
  { id: "c3", name: "Other", count: 1 },
];

const COPY = {
  heading: "Administrar categorías",
  description:
    "Agrega categorías, cambia su nombre o elimina las que ya no uses.",
  listAriaLabel: "Categorías de ingresos",
  countLabel: (count: number) =>
    count === 0
      ? "Sin ingresos"
      : count === 1
        ? "1 ingreso"
        : `${count} ingresos`,
};

const renderDrawer = () =>
  render(
    <ManageCategoriesDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={() => {}}
      categories={CATEGORIES}
      copy={COPY}
      actions={{
        create: actions.createCategoryAction,
        rename: actions.renameCategoryAction,
        remove: actions.deleteCategoryAction,
      }}
    />,
  );

const rowNames = () =>
  screen
    .getAllByRole("listitem")
    .map((row) => within(row).getByTestId("category-name").textContent);

const startRename = (name: string) =>
  fireEvent.click(
    screen.getByRole("button", { name: `Cambiar el nombre de ${name}` }),
  );

const renameInput = () =>
  screen.queryByRole("textbox", { name: "Nombre de la categoría" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("category list", () => {
  it("lists the categories alphabetically with how many incomes use each", () => {
    renderDrawer();

    expect(rowNames()).toEqual(["Gifts", "Other", "Salary"]);

    const rows = screen.getAllByRole("listitem");

    expect(rows[0]).toHaveTextContent("Sin ingresos");
    expect(rows[1]).toHaveTextContent("1 ingreso");
    expect(rows[1]).not.toHaveTextContent("1 incomes");
    expect(rows[2]).toHaveTextContent("3 ingresos");
  });
});

const newCategoryInput = () =>
  screen.getByRole("textbox", { name: "Nombre de la nueva categoría" });
const addButton = () => screen.getByRole("button", { name: /^Agregar/ });

describe("add", () => {
  it("offers a name field and an Add button that waits for a name", () => {
    renderDrawer();

    expect(newCategoryInput()).toHaveValue("");
    expect(addButton()).toBeDisabled();

    fireEvent.change(newCategoryInput(), { target: { value: "Rent" } });

    expect(addButton()).toBeEnabled();
  });

  it("creates through the action, lists it alphabetically and clears the field", async () => {
    actions.createCategoryAction.mockResolvedValue({
      status: "success",
      category: { id: "c9", name: "Freelance" },
    });
    renderDrawer();

    fireEvent.change(newCategoryInput(), { target: { value: "Freelance" } });
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(rowNames()).toEqual(["Freelance", "Gifts", "Other", "Salary"]),
    );
    expect(actions.createCategoryAction).toHaveBeenCalledWith("Freelance");
    expect(newCategoryInput()).toHaveValue("");
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
      "Sin ingresos",
    );
  });

  it("adds with Enter", async () => {
    actions.createCategoryAction.mockResolvedValue({
      status: "success",
      category: { id: "c9", name: "Rent" },
    });
    renderDrawer();

    fireEvent.change(newCategoryInput(), { target: { value: "Rent" } });
    fireEvent.keyDown(newCategoryInput(), { key: "Enter" });

    await waitFor(() =>
      expect(actions.createCategoryAction).toHaveBeenCalledWith("Rent"),
    );
  });

  it("keeps what was typed and shows the error when the name is rejected", async () => {
    actions.createCategoryAction.mockResolvedValue({
      status: "error",
      message: "Revisa los datos.",
      fieldErrors: { name: ["Ya tienes una categoría con este nombre."] },
    });
    renderDrawer();

    fireEvent.change(newCategoryInput(), { target: { value: "Salary" } });
    fireEvent.click(addButton());

    expect(
      await screen.findByText("Ya tienes una categoría con este nombre."),
    ).toBeInTheDocument();
    expect(newCategoryInput()).toHaveValue("Salary");
    expect(rowNames()).toEqual(["Gifts", "Other", "Salary"]);
  });

  it("shows 'Agregando…' with a spinner while it creates", async () => {
    let finish!: (value: unknown) => void;

    actions.createCategoryAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderDrawer();

    fireEvent.change(newCategoryInput(), { target: { value: "Rent" } });
    fireEvent.click(addButton());

    const pending = await screen.findByRole("button", { name: /Agregando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();

    finish({ status: "success", category: { id: "c9", name: "Rent" } });

    await waitFor(() => expect(rowNames()).toContain("Rent"));
  });
});

describe("rename", () => {
  it("edits inline, saves through the action and re-sorts the list", async () => {
    actions.renameCategoryAction.mockResolvedValue({
      status: "success",
      category: { id: "c1", name: "Presents" },
    });
    renderDrawer();

    startRename("Gifts");

    expect(renameInput()).toHaveValue("Gifts");

    fireEvent.change(renameInput()!, { target: { value: "Presents" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(renameInput()).not.toBeInTheDocument());
    expect(actions.renameCategoryAction).toHaveBeenCalledWith("c1", "Presents");
    expect(rowNames()).toEqual(["Other", "Presents", "Salary"]);
  });

  it("saves with Enter", async () => {
    actions.renameCategoryAction.mockResolvedValue({
      status: "success",
      category: { id: "c1", name: "Presents" },
    });
    renderDrawer();

    startRename("Gifts");
    fireEvent.change(renameInput()!, { target: { value: "Presents" } });
    fireEvent.keyDown(renameInput()!, { key: "Enter" });

    await waitFor(() =>
      expect(actions.renameCategoryAction).toHaveBeenCalledWith(
        "c1",
        "Presents",
      ),
    );
  });

  it("cancels with Escape without calling the action", () => {
    renderDrawer();

    startRename("Gifts");
    fireEvent.change(renameInput()!, { target: { value: "Presents" } });
    fireEvent.keyDown(renameInput()!, { key: "Escape" });

    expect(renameInput()).not.toBeInTheDocument();
    expect(actions.renameCategoryAction).not.toHaveBeenCalled();
    expect(rowNames()).toEqual(["Gifts", "Other", "Salary"]);
  });

  it("cancels with the Cancel button", () => {
    renderDrawer();

    startRename("Gifts");
    fireEvent.click(
      within(screen.getAllByRole("listitem")[0]).getByRole("button", {
        name: "Cancelar",
      }),
    );

    expect(renameInput()).not.toBeInTheDocument();
    expect(actions.renameCategoryAction).not.toHaveBeenCalled();
  });

  it("closes without calling the action when the name did not change", () => {
    renderDrawer();

    startRename("Gifts");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(renameInput()).not.toBeInTheDocument();
    expect(actions.renameCategoryAction).not.toHaveBeenCalled();
  });

  it("keeps editing and shows the error when the name is rejected", async () => {
    actions.renameCategoryAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tienes una categoría con este nombre."] },
    });
    renderDrawer();

    startRename("Gifts");
    fireEvent.change(renameInput()!, { target: { value: "Salary" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Ya tienes una categoría con este nombre."),
    ).toBeInTheDocument();
    expect(renameInput()).toHaveValue("Salary");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("delete", () => {
  const confirmDialog = async () => screen.findByRole("alertdialog");

  it("asks for confirmation, then deletes and removes the row", async () => {
    actions.deleteCategoryAction.mockResolvedValue({ status: "success" });
    renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Gifts" }));

    const dialog = await confirmDialog();

    expect(dialog).toHaveTextContent("Gifts");
    expect(actions.deleteCategoryAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(actions.deleteCategoryAction).toHaveBeenCalledWith("c1"),
    );
    await waitFor(() => expect(rowNames()).toEqual(["Other", "Salary"]));
  });

  it("does nothing when the confirmation is cancelled", async () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Gifts" }));
    fireEvent.click(
      within(await confirmDialog()).getByRole("button", { name: "Cancelar" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(actions.deleteCategoryAction).not.toHaveBeenCalled();
    expect(rowNames()).toEqual(["Gifts", "Other", "Salary"]);
  });

  it("keeps the row and shows the error inline when the delete is refused", async () => {
    actions.deleteCategoryAction.mockResolvedValue({
      status: "error",
      message:
        "3 ingresos todavía usan esta categoría. Muévelos o elimínalos primero.",
    });
    renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar Salary" }));
    fireEvent.click(
      within(await confirmDialog()).getByRole("button", { name: "Eliminar" }),
    );

    const message = await screen.findByText(
      "3 ingresos todavía usan esta categoría. Muévelos o elimínalos primero.",
    );

    expect(
      within(screen.getAllByRole("listitem")[2]).getByText(
        message.textContent!,
      ),
    ).toBe(message);
    expect(rowNames()).toEqual(["Gifts", "Other", "Salary"]);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });
});
