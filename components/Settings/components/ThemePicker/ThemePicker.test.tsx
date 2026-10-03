// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
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

import { ThemePicker } from "./ThemePicker";

const choose = (name: string) => {
  fireEvent.click(screen.getByRole("radio", { name }));
};

const checkedLabels = () =>
  screen
    .getAllByRole("radio")
    .filter((radio) => (radio as HTMLInputElement).checked)
    .map((radio) => radio.closest("label")?.textContent);

beforeEach(() => {
  themes.resolvedTheme = "light";
  themes.setTheme.mockClear();
});

describe("ThemePicker", () => {
  it("renders on the server with nothing ticked, as the server cannot know the stored theme", () => {
    // The server's HTML is what the client's first render must match: a tick drawn only by the
    // client (the theme comes from localStorage) is a hydration mismatch.
    const html = renderToString(<ThemePicker />);

    expect(html).not.toMatch(/checked=""/);
    expect(html).not.toContain('data-selected="true"');
  });

  it("is one group named Tema", () => {
    render(<ThemePicker />);

    expect(
      screen.getByRole("radiogroup", { name: "Tema" }),
    ).toBeInTheDocument();
  });

  it("lists every theme of the app, with its label, in the order of the account menu", () => {
    render(<ThemePicker />);

    expect(THEMES).toHaveLength(13);
    expect(
      screen
        .getAllByRole("radio")
        .map((radio) => radio.closest("label")?.textContent),
    ).toEqual(THEMES.map((theme) => theme.label));
  });

  it("previews each theme with its five palette colours, as decoration", () => {
    render(<ThemePicker />);

    for (const theme of THEMES) {
      const option = screen
        .getByRole("radio", { name: theme.label })
        .closest("label");
      const swatches = option?.querySelectorAll<HTMLElement>(
        '[aria-hidden="true"] > span',
      );

      expect(
        Array.from(swatches ?? []).map((swatch) =>
          swatch.style.backgroundColor.toLowerCase(),
        ),
      ).toEqual(
        theme.colors.map((color) => {
          const probe = document.createElement("span");

          probe.style.backgroundColor = color;

          return probe.style.backgroundColor.toLowerCase();
        }),
      );
    }
  });

  it("ticks the theme that is showing", () => {
    themes.resolvedTheme = "ocean";
    render(<ThemePicker />);

    expect(checkedLabels()).toEqual(["Brisa oceánica"]);
  });

  it("ticks the theme that is showing even when it was never chosen, as for a device in dark mode", () => {
    themes.resolvedTheme = "dark";
    render(<ThemePicker />);

    expect(checkedLabels()).toEqual(["Modo oscuro"]);
  });

  it("ticks nothing until the theme is known", () => {
    themes.resolvedTheme = undefined;
    render(<ThemePicker />);

    expect(checkedLabels()).toEqual([]);
  });

  it.each(THEMES)(
    "applies the $label theme by its own id, $id, as soon as it is chosen",
    ({ id, label }) => {
      // Choosing the theme that is already showing changes nothing, so start from another one.
      themes.resolvedTheme = id === "light" ? "dark" : "light";
      render(<ThemePicker />);

      choose(label);

      expect(themes.setTheme).toHaveBeenCalledTimes(1);
      expect(themes.setTheme).toHaveBeenCalledWith(id);
    },
  );
});

describe("ThemePicker while the theme animation runs", () => {
  let finish: () => void;

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

  it("animates the change through the view transition, like the account menu", () => {
    render(<ThemePicker />);

    choose("Modo oscuro");

    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(themes.setTheme).toHaveBeenCalledWith("dark");
  });

  it("ignores a second choice made while the first is still animating, and accepts one after", async () => {
    render(<ThemePicker />);

    choose("Modo oscuro");
    choose("Brisa oceánica");

    expect(themes.setTheme).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    await waitFor(() => {
      choose("Brisa oceánica");

      expect(themes.setTheme).toHaveBeenLastCalledWith("ocean");
    });
  });
});
