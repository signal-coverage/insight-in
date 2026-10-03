import { describe, expect, it } from "vitest";

import { THEME_IDS, THEMES } from "./themes";

describe("THEMES", () => {
  it("keeps the two original themes, light first, under the ids they were stored with", () => {
    expect(THEME_IDS.slice(0, 2)).toEqual(["light", "dark"]);
  });

  it("calls the two original themes the light and the dark mode", () => {
    expect(THEMES.slice(0, 2).map((theme) => theme.label)).toEqual([
      "Modo claro",
      "Modo oscuro",
    ]);
  });

  it("lists the themes in the order they were added", () => {
    expect(THEME_IDS).toEqual([
      "light",
      "dark",
      "ocean",
      "rustic",
      "coastal",
      "harmony",
      "beach",
      "sky",
      "twilight",
      "autumn",
      "cozy",
      "minimalist",
      "forest",
    ]);
  });

  it("writes every id as a plain lowercase word, since it is also a CSS class on <html>", () => {
    THEME_IDS.forEach((id) => expect(id).toMatch(/^[a-z]+$/));
  });

  it("gives every theme its own id", () => {
    expect(new Set(THEME_IDS).size).toBe(THEMES.length);
  });

  it("gives every theme its own label, so the menu never lists two alike", () => {
    expect(new Set(THEMES.map((theme) => theme.label)).size).toBe(
      THEMES.length,
    );
  });

  it("gives every theme five different colours to preview it with", () => {
    for (const theme of THEMES) {
      expect(theme.colors).toHaveLength(5);
      expect(new Set(theme.colors).size).toBe(5);

      for (const color of theme.colors) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});
