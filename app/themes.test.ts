import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEME_IDS } from "@/lib/themes";

// Light is the base (`:root`) and dark has its own block in globals.css. Every other theme is a
// class on <html> in themes.css: it declares its five colours and a few roles (page, ink, accent,
// ...), and one shared rule turns those roles into HeroUI's semantic tokens and the button
// hierarchy. A theme that forgets a role would leave a token unset and look half-finished, so this
// guard reads the stylesheets, where it all lives.

const CSS = readFileSync(join(__dirname, "globals.css"), "utf8");
const THEMES_CSS = readFileSync(join(__dirname, "themes.css"), "utf8");

const OTHER_THEMES = THEME_IDS.filter((id) => id !== "light");
// The themes made of roles: all but the two that are written out by hand.
const ROLE_THEMES = OTHER_THEMES.filter((id) => id !== "dark");

// The text of the block that starts at `start`, found by matching braces.
const blockFrom = (source: string, start: number): string => {
  const open = source.indexOf("{", start);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open, index + 1);
  }

  throw new Error("Unbalanced braces in the stylesheet");
};

const blockAt = (source: string, pattern: RegExp, what: string): string => {
  const match = pattern.exec(source);

  if (!match) throw new Error(`No ${what} in the stylesheet`);

  return blockFrom(source, match.index);
};

const themeBlock = (id: string): string =>
  id === "dark"
    ? blockAt(CSS, /^\.dark \{/m, ".dark block")
    : blockAt(THEMES_CSS, new RegExp(`^\\.${id} \\{`, "m"), `.${id} block`);

// The selector that carries the shared rules: every role theme, nothing else.
const SHARED_SELECTOR = /^:root:is\(([^)]*)\) \{/m;

const sharedMapping = (): string =>
  blockAt(THEMES_CSS, SHARED_SELECTOR, "shared token mapping");

const idsIn = (selectorList: string): string[] =>
  selectorList.split(",").map((selector) => selector.trim().replace(/^\./, ""));

// The semantic tokens a block sets (a theme's own palette colours are not part of the contract).
const tokensOf = (block: string): string[] =>
  [...block.matchAll(/^\s*(--[\w-]+):/gm)]
    .map((match) => match[1])
    .filter(
      (token) => !token.startsWith("--palette-") && !token.startsWith("--p-"),
    );

// The roles every theme must declare: those the shared rules read without a fallback.
const REQUIRED_ROLES = [
  ...new Set(
    [...THEMES_CSS.matchAll(/var\((--t-[\w-]+)\)/g)].map((match) => match[1]),
  ),
];

describe("theme stylesheet", () => {
  it.each(OTHER_THEMES)("defines a .%s block", (id) => {
    expect(() => themeBlock(id)).not.toThrow();
  });

  it("applies the shared rules to every role theme and to no other", () => {
    const match = SHARED_SELECTOR.exec(THEMES_CSS);

    expect(match).not.toBeNull();
    expect(idsIn(match![1]).sort()).toEqual([...ROLE_THEMES].sort());
  });

  it("sets every semantic token of the dark theme in the shared mapping too", () => {
    const required = tokensOf(themeBlock("dark"));

    expect(required.length).toBeGreaterThan(20);
    expect(tokensOf(sharedMapping())).toEqual(expect.arrayContaining(required));
  });

  it("asks of every theme a good number of roles", () => {
    expect(REQUIRED_ROLES.length).toBeGreaterThan(15);
  });

  it.each(ROLE_THEMES)(
    "declares every role the shared rules read in the %s theme",
    (id) => {
      expect(tokensOf(themeBlock(id))).toEqual(
        expect.arrayContaining(REQUIRED_ROLES),
      );
    },
  );

  it.each(ROLE_THEMES)(
    "gives the %s theme a light or dark colour scheme, which next-themes only sets for light and dark",
    (id) => {
      expect(themeBlock(id)).toMatch(/--t-scheme:\s*(light|dark);/);
    },
  );

  it("sets the colour scheme from that role in the shared mapping", () => {
    expect(sharedMapping()).toMatch(/color-scheme:\s*var\(--t-scheme\);/);
  });

  it.each(["primary", "secondary", "tertiary", "danger-soft", "danger"])(
    "gives every role theme its own %s button through the shared rules",
    (variant) => {
      expect(THEMES_CSS).toMatch(
        new RegExp(`^:root:is\\([^)]*\\)\\s+\\.button--${variant}\\s*\\{`, "m"),
      );
    },
  );

  it("limits the light primary button to the light theme, so each other theme sets its own", () => {
    const match = /:root:not\(([^)]*)\)\s+\.button--primary/.exec(CSS);

    expect(match).not.toBeNull();
    expect(idsIn(match![1]).sort()).toEqual([...OTHER_THEMES].sort());
  });
});

// The theme switch reveals the new theme as a growing circle (a mask on the view transition's
// new snapshot). An SVG mask with a blur filter has to be rasterised again at every size it
// grows through, up to the whole screen: in a real, GPU-backed Chrome that ran at a couple of
// frames per second. A gradient mask is drawn by the GPU and keeps the soft edge.
describe("theme reveal", () => {
  const revealBlock = (): string =>
    blockAt(CSS, /^::view-transition-new\(root\) \{/m, "reveal rule");

  it("masks the new theme with a radial gradient, not an image", () => {
    expect(revealBlock()).toContain("radial-gradient(");
    expect(revealBlock()).not.toContain("url(");
  });

  it("grows the circle through a registered length, which the gradient reads", () => {
    expect(CSS).toMatch(
      /@property --reveal \{[^}]*syntax:\s*"<length>";[^}]*\}/,
    );
    expect(CSS).toMatch(/@keyframes theme-reveal \{[^}]*--reveal:/);
  });

  it("has no SVG filter left in the stylesheet", () => {
    expect(CSS).not.toContain("feGaussianBlur");
  });
});
