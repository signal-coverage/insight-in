// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createCategoryAction = vi.fn();

import { CategoryField } from "./CategoryField";

const CATEGORIES = [
  { id: "c1", name: "Freelance" },
  { id: "c2", name: "Salary" },
];

const renderField = (defaultCategoryId: string | null = null) =>
  render(
    <CategoryField
      categories={CATEGORIES}
      defaultCategoryId={defaultCategoryId}
      onCreate={createCategoryAction}
    />,
  );

const trigger = () => screen.getByRole("button", { name: /categoría/i });

const pickOption = async (name: string | RegExp) => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const newCategoryInput = () =>
  screen.queryByRole("textbox", { name: "Nombre de la nueva categoría" });

const addRowButton = () => screen.queryByRole("button", { name: "Agregar" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CategoryField add row", () => {
  it("opens the add row when the action item is chosen and keeps the value", async () => {
    renderField("c2");

    await pickOption(/agregar categoría/i);

    await waitFor(() => expect(newCategoryInput()).toBeInTheDocument());
    expect(trigger()).toHaveTextContent("Salary");
  });

  it("closes the add row and clears what was typed once a real category is chosen", async () => {
    renderField();

    await pickOption(/agregar categoría/i);
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Nombre de la nueva categoría",
      }),
      {
        target: { value: "Rent" },
      },
    );

    await pickOption("Freelance");

    await waitFor(() => expect(newCategoryInput()).not.toBeInTheDocument());
    expect(addRowButton()).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Freelance");

    await pickOption(/agregar categoría/i);

    expect(
      await screen.findByRole("textbox", {
        name: "Nombre de la nueva categoría",
      }),
    ).toHaveValue("");
  });

  it("closes the add row and clears its error when a category is chosen", async () => {
    createCategoryAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tienes una categoría con este nombre."] },
    });
    renderField();

    await pickOption(/agregar categoría/i);
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Nombre de la nueva categoría",
      }),
      {
        target: { value: "Salary" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    await screen.findByText("Ya tienes una categoría con este nombre.");

    await pickOption("Salary");
    await waitFor(() => expect(newCategoryInput()).not.toBeInTheDocument());

    await pickOption(/agregar categoría/i);
    await screen.findByRole("textbox", {
      name: "Nombre de la nueva categoría",
    });

    expect(
      screen.queryByText("Ya tienes una categoría con este nombre."),
    ).not.toBeInTheDocument();
  });

  it("closes the add row and selects the new category after a successful creation", async () => {
    createCategoryAction.mockResolvedValue({
      status: "success",
      category: { id: "c9", name: "Rent" },
    });
    renderField();

    await pickOption(/agregar categoría/i);
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Nombre de la nueva categoría",
      }),
      {
        target: { value: "Rent" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await waitFor(() => expect(newCategoryInput()).not.toBeInTheDocument());
    expect(trigger()).toHaveTextContent("Rent");
  });

  it("does not override a newer choice when a pending creation finishes later", async () => {
    let resolveCreation: (value: unknown) => void = () => {};

    createCategoryAction.mockReturnValue(
      new Promise((resolve) => {
        resolveCreation = resolve;
      }),
    );
    renderField();

    await pickOption(/agregar categoría/i);
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Nombre de la nueva categoría",
      }),
      {
        target: { value: "Rent" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    await pickOption("Salary");
    await waitFor(() => expect(newCategoryInput()).not.toBeInTheDocument());

    await act(async () => {
      resolveCreation({
        status: "success",
        category: { id: "c9", name: "Rent" },
      });
    });

    expect(trigger()).toHaveTextContent("Salary");
    expect(newCategoryInput()).not.toBeInTheDocument();

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });

    expect(
      await screen.findByRole("option", { name: "Rent" }),
    ).toBeInTheDocument();
  });
});
