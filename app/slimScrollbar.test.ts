import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LIST_CLASS_NAME } from "@/components/Roadmap/components/Board/components/BoardColumn/styles";
import { BOARD_GRID_CLASS_NAME } from "@/components/Roadmap/styles";

const CSS = readFileSync(join(__dirname, "globals.css"), "utf8");

const ruleOf = (selector: string): string => {
  const start = CSS.indexOf(`${selector} {`);

  if (start === -1) {
    throw new Error(`${selector} was not found in globals.css`);
  }

  return CSS.slice(start, CSS.indexOf("}", start));
};

describe("slim-scrollbar", () => {
  it("is a thin scrollbar that takes the theme's accent over a see-through track", () => {
    const rule = ruleOf(".slim-scrollbar");

    expect(rule).toContain("scrollbar-width: thin");
    expect(rule).toMatch(
      /scrollbar-color:[^;]*var\(--accent\)[^;]*transparent/,
    );
  });

  it("keeps room for the bar, so the cards do not shift when it appears", () => {
    expect(ruleOf(".slim-scrollbar")).toContain("scrollbar-gutter: stable");
  });

  it("is what the cards of a column and the board itself scroll with", () => {
    expect(LIST_CLASS_NAME).toContain("slim-scrollbar");
    expect(BOARD_GRID_CLASS_NAME).toContain("slim-scrollbar");
  });
});
