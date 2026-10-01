import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every button, and every input, has the same corner radius: HeroUI's `--field-radius`. The only
// exceptions are the sidebar's round toggle chip and the pieces inside the date picker and the
// calendar, which keep HeroUI's own look. A button that sits next to an input (the "Agregar"
// button beside the new-category field) therefore never looks squarer or rounder than it.
// This guard reads the stylesheet, since the rule lives there and not in any component.

const CSS = readFileSync(join(__dirname, "globals.css"), "utf8");

const BUTTON_RULE_START = 'button:not([class*="cl-"]) {';

// The text of the block that starts at `start`, found by matching braces.
const blockFrom = (source: string, start: number): string => {
  const open = source.indexOf("{", start);
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open, index + 1);
  }

  throw new Error("Unbalanced braces in globals.css");
};

const buttonRule = (): string => {
  const start = CSS.indexOf(BUTTON_RULE_START);

  if (start === -1)
    throw new Error("The global button rule was not found in globals.css");

  return blockFrom(CSS, start);
};

const radiiIn = (block: string): string[] =>
  [...block.matchAll(/border-radius:\s*([^;]+);/g)].map((match) =>
    match[1].trim(),
  );

describe("control radius", () => {
  it("gives every button the radius of the inputs by default", () => {
    const declarations = buttonRule().split("\n");
    const firstRadius = declarations.find((line) =>
      line.includes("border-radius"),
    );

    expect(firstRadius?.trim()).toBe("border-radius: var(--field-radius);");
  });

  it("allows no other radius on a button than the field radius, the round chip and the date picker's own", () => {
    expect(new Set(radiiIn(buttonRule()))).toEqual(
      new Set(["var(--field-radius)", "9999px", "revert-layer"]),
    );
  });

  it("has no per-button opt-in to the field radius left, since that is now the default", () => {
    expect(CSS).not.toContain("app-button--field");
  });
});
