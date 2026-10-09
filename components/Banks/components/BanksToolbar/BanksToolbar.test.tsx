// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BanksToolbar } from "./BanksToolbar";

const renderToolbar = (query = "", showArchived = false) => {
  const handlers = { onQueryChange: vi.fn(), onShowArchivedChange: vi.fn() };

  render(
    <BanksToolbar query={query} showArchived={showArchived} {...handlers} />,
  );

  return handlers;
};

const search = () =>
  screen.getByRole("searchbox", { name: "Buscar bancos y cuentas" });
const toggle = () => screen.getByRole("switch", { name: "Mostrar archivados" });

describe("BanksToolbar", () => {
  it("has a search field with a Spanish placeholder", () => {
    renderToolbar();

    expect(search()).toHaveAttribute("placeholder", "Buscar banco o cuenta");
  });

  it("shows the query it is given", () => {
    renderToolbar("galicia");

    expect(search()).toHaveValue("galicia");
  });

  it("reports what is typed", () => {
    const { onQueryChange } = renderToolbar();

    fireEvent.change(search(), { target: { value: "ahorro" } });

    expect(onQueryChange).toHaveBeenCalledWith("ahorro");
  });

  it("has a switch for the archived items, off by default", () => {
    renderToolbar();

    expect(toggle()).not.toBeChecked();
  });

  it("shows the switch on when archived items are shown", () => {
    renderToolbar("", true);

    expect(toggle()).toBeChecked();
  });

  it("reports the new value when the switch is toggled", () => {
    const { onShowArchivedChange } = renderToolbar();

    fireEvent.click(toggle());

    expect(onShowArchivedChange).toHaveBeenCalledWith(true);
  });
});
