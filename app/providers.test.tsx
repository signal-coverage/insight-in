// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useTheme } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_IDS } from "@/lib/themes";

import { Providers } from "./providers";

// One button per theme, each choosing it the way the account menu does.
function ThemeButtons() {
  const { setTheme } = useTheme();

  return THEME_IDS.map((id) => (
    <button key={id} onClick={() => setTheme(id)}>
      {id}
    </button>
  ));
}

const mountProviders = () =>
  render(
    <Providers>
      <ThemeButtons />
    </Providers>,
  );

const choose = (id: string) =>
  fireEvent.click(screen.getByRole("button", { name: id }));

const themeClasses = () =>
  THEME_IDS.filter((id) => document.documentElement.classList.contains(id));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Providers themes", () => {
  it.each(THEME_IDS)(
    "puts the %s theme on <html> as the only theme class",
    (id) => {
      mountProviders();

      choose(id);

      expect(themeClasses()).toEqual([id]);
    },
  );

  it("swaps the previous theme for the new one", () => {
    mountProviders();

    choose("dark");
    choose("ocean");

    expect(themeClasses()).toEqual(["ocean"]);
  });
});
