// @vitest-environment jsdom
import { PlusIcon, TagIcon } from "@heroicons/react/24/outline";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionsMenu } from "./ActionsMenu";

const ITEMS = [
  { id: "add", label: "Agregar gasto", Icon: PlusIcon },
  { id: "categories", label: "Administrar categorías", Icon: TagIcon },
];

const renderMenu = () => {
  const onAction = vi.fn();

  render(<ActionsMenu label="Acciones" items={ITEMS} onAction={onAction} />);

  return { onAction };
};

const trigger = () => screen.getByRole("button", { name: "Acciones" });

const openMenu = () => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  return screen.findByRole("menu");
};

describe("ActionsMenu", () => {
  it("is a single button named after its label, announcing a menu", () => {
    renderMenu();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(trigger()).toHaveAttribute("aria-haspopup", "true");
  });

  it("lists the items in the order they are given", async () => {
    renderMenu();

    await openMenu();

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Agregar gasto", "Administrar categorías"]);
  });

  it("gives every item a decorative icon", async () => {
    renderMenu();

    await openMenu();

    screen.getAllByRole("menuitem").forEach((item) => {
      expect(item.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it("reports the id of the chosen item", async () => {
    const { onAction } = renderMenu();

    await openMenu();

    const item = screen.getByRole("menuitem", {
      name: "Administrar categorías",
    });

    fireEvent.keyDown(item, { key: "Enter" });
    fireEvent.keyUp(item, { key: "Enter" });

    expect(onAction).toHaveBeenCalledWith("categories");
  });
});
