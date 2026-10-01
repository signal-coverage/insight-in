// @vitest-environment jsdom
import { Button, Dropdown } from "@heroui/react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const themes = vi.hoisted(() => ({
  resolvedTheme: "light" as string | undefined,
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: themes.resolvedTheme,
    setTheme: themes.setTheme,
  }),
}));

import { THEMES } from "@/lib/themes";

import { AccountMenuTheme } from "./AccountMenuTheme";

const renderMenu = () =>
  render(
    <Dropdown>
      <Button aria-label="Cuenta">Cuenta</Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Menú">
          <AccountMenuTheme
            popoverClassName="shared-popover"
            menuClassName="shared-menu"
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>,
  );

const openThemes = async () => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Cuenta" }), {
    key: "ArrowDown",
  });

  const entry = await screen.findByRole("menuitem", { name: "Tema" });

  fireEvent.keyDown(entry, { key: "ArrowRight" });

  return screen.findByRole("menu", { name: "Tema" });
};

const choose = (name: string) => {
  const option = screen.getByRole("menuitemradio", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const checkedOptions = () =>
  screen
    .getAllByRole("menuitemradio")
    .filter((option) => option.getAttribute("aria-checked") === "true")
    .map((option) => option.textContent);

beforeEach(() => {
  themes.resolvedTheme = "light";
  themes.setTheme.mockClear();
});

describe("AccountMenuTheme", () => {
  it("is one entry named Tema that opens a submenu", async () => {
    renderMenu();
    fireEvent.keyDown(screen.getByRole("button", { name: "Cuenta" }), {
      key: "ArrowDown",
    });

    const entry = await screen.findByRole("menuitem", { name: "Tema" });

    expect(entry).toHaveAttribute("aria-haspopup", "menu");
    expect(entry.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("looks like the menu it opens from: same popover and menu classes, so same radius and border", async () => {
    renderMenu();

    const submenu = await openThemes();

    expect(submenu).toHaveClass("shared-menu");
    expect(submenu.closest(".dropdown__popover")).toHaveClass("shared-popover");
  });

  it("no longer offers the light/dark switch", async () => {
    renderMenu();
    await openThemes();

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("lists the light mode, the dark mode and then the other themes", async () => {
    renderMenu();
    await openThemes();

    expect(
      screen.getAllByRole("menuitemradio").map((option) => option.textContent),
    ).toEqual(THEMES.map((theme) => theme.label));
    expect(screen.getAllByRole("menuitemradio")[0]).toHaveTextContent(
      "Modo claro",
    );
    expect(screen.getAllByRole("menuitemradio")[1]).toHaveTextContent(
      "Modo oscuro",
    );
  });

  it("has no system choice: every entry is a theme of its own", async () => {
    renderMenu();
    await openThemes();

    expect(
      screen.queryByRole("menuitemradio", { name: "Sistema" }),
    ).not.toBeInTheDocument();
  });

  it("marks the theme in use as the chosen one", async () => {
    themes.resolvedTheme = "ocean";
    renderMenu();
    await openThemes();

    expect(checkedOptions()).toEqual(["Brisa oceánica"]);
  });

  it("marks the theme that is showing even when it was never chosen, as for a device in dark mode", async () => {
    themes.resolvedTheme = "dark";
    renderMenu();
    await openThemes();

    expect(checkedOptions()).toEqual(["Modo oscuro"]);
  });

  it("marks nothing until the theme is known", async () => {
    themes.resolvedTheme = undefined;
    renderMenu();
    await openThemes();

    expect(checkedOptions()).toEqual([]);
  });

  it.each(THEMES)(
    "applies the $label theme by its own id, $id",
    async ({ id, label }) => {
      // Choosing the theme that is already showing changes nothing, so start from another one.
      themes.resolvedTheme = id === "light" ? "dark" : "light";
      renderMenu();
      await openThemes();

      choose(label);

      expect(themes.setTheme).toHaveBeenCalledWith(id);
    },
  );

  it("stays open after a choice, so themes can be tried one after another", async () => {
    renderMenu();
    await openThemes();

    choose("Modo oscuro");

    expect(screen.getByRole("menu", { name: "Tema" })).toBeInTheDocument();
  });
});

describe("AccountMenuTheme while the theme animation runs", () => {
  let finish: () => void;

  const options = () => screen.getAllByRole("menuitemradio");
  const allDisabled = () =>
    options().every(
      (option) => option.getAttribute("aria-disabled") === "true",
    );
  const noneDisabled = () =>
    options().every(
      (option) => option.getAttribute("aria-disabled") !== "true",
    );

  beforeEach(() => {
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });

    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn((update: () => void) => {
        update();

        return { ready: finished, finished };
      }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
    vi.unstubAllGlobals();
  });

  it("disables every theme until the animation has finished", async () => {
    renderMenu();
    await openThemes();

    choose("Modo oscuro");

    await waitFor(() => expect(allDisabled()).toBe(true));

    await act(async () => finish());

    await waitFor(() => expect(noneDisabled()).toBe(true));
  });

  it("ignores a second choice made while the first is still animating", async () => {
    renderMenu();
    await openThemes();

    choose("Modo oscuro");
    await waitFor(() => expect(allDisabled()).toBe(true));
    choose("Brisa oceánica");

    expect(themes.setTheme).toHaveBeenCalledTimes(1);
    expect(themes.setTheme).toHaveBeenCalledWith("dark");

    await act(async () => finish());
  });

  it("accepts a new choice once the animation is over", async () => {
    renderMenu();
    await openThemes();

    choose("Modo oscuro");
    await act(async () => finish());
    await waitFor(() => expect(noneDisabled()).toBe(true));
    choose("Brisa oceánica");

    expect(themes.setTheme).toHaveBeenLastCalledWith("ocean");
  });
});
