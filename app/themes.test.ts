import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEME_IDS, THEMES } from "@/lib/themes";

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

// The hex colours a block declares with the given variable pattern, in lower case.
const paletteColors = (source: string, pattern: RegExp): string[] =>
  [...source.matchAll(pattern)].map((match) => match[1].toLowerCase());

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

  // The previews of the settings page draw each theme from lib/themes.ts, so what they show must be
  // what the stylesheet declares: light and dark keep their palette on :root, the rest in --p-*.
  it.each(THEMES)(
    "previews the $id theme with colours its stylesheet really declares",
    ({ id, colors }) => {
      const declared =
        id === "light" || id === "dark"
          ? paletteColors(CSS, /^\s*--palette-[\w-]+:\s*(#[0-9a-f]{6});/gim)
          : paletteColors(
              themeBlock(id),
              /^\s*--p-[\w-]+:\s*(#[0-9a-f]{6});/gim,
            );

      expect(declared).toEqual(expect.arrayContaining([...colors]));
    },
  );

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

// Red means "this removes something" and green means "this confirms money" in every theme, so the
// destructive buttons and the status tick read the same way whatever the palette.
describe("red and green", () => {
  it("makes the destructive buttons red in light and dark, from the danger token", () => {
    for (const selector of [
      /^\.button--danger \{/m,
      /^\.dark \.button--danger \{/m,
    ]) {
      expect(blockAt(CSS, selector, "danger button")).toContain(
        "var(--danger)",
      );
    }
  });

  it("makes the trash buttons a red tint with a red icon in light and dark", () => {
    for (const selector of [
      /^\.button--danger-soft \{/m,
      /^\.dark \.button--danger-soft \{/m,
    ]) {
      const block = blockAt(CSS, selector, "danger-soft button");

      expect(block).toContain("--button-fg: var(--danger);");
      expect(block).toContain("var(--danger-soft)");
    }
  });

  it("gives the trash buttons a red outline like the edit button's, in light, dark and every role theme", () => {
    const blocks = [
      blockAt(CSS, /^\.button--danger-soft \{/m, "light trash button"),
      blockAt(CSS, /^\.dark \.button--danger-soft \{/m, "dark trash button"),
      blockAt(
        THEMES_CSS,
        /^:root:is\([^)]*\)\s+\.button--danger-soft \{/m,
        "shared trash button",
      ),
    ];

    for (const block of blocks) {
      expect(block).toMatch(
        /border:\s*1px solid var\(--(danger|t-negative)\);/,
      );
    }
  });

  it("makes the destructive buttons of every role theme red through the shared rules", () => {
    const danger = blockAt(
      THEMES_CSS,
      /^:root:is\([^)]*\)\s+\.button--danger \{/m,
      "shared danger button",
    );

    expect(danger).toContain("var(--t-negative)");
  });

  it("gives every theme a green, through the positive tokens", () => {
    expect(tokensOf(themeBlock("dark"))).toContain("--positive");
    expect(tokensOf(sharedMapping())).toContain("--positive");
    expect(tokensOf(CSS.slice(CSS.indexOf(":root {")))).toContain("--positive");
  });

  it("colours the wizard's choices: Habilitar green, Quitar red", () => {
    expect(
      blockAt(CSS, /^\.choice--positive \{/m, "positive choice"),
    ).toContain("var(--positive)");
    expect(
      blockAt(CSS, /^\.choice--negative \{/m, "negative choice"),
    ).toContain("var(--danger)");
  });

  it("turns the status tick green", () => {
    const tick = blockAt(CSS, /^\.status-checkbox \{/m, "status checkbox rule");

    expect(tick).toContain("var(--positive)");
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
