import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// The edit (pencil) button sits next to the delete (trash) button, which has a red tint of its own.
// As a plain, background-less icon the pencil was lost beside it, so every edit button is a
// `secondary` button: it has a fill and a border, and reads as a button at a glance. This guard
// reads the sources, since the style is a prop on a HeroUI Button in each table and list row.

const ROOT = join(__dirname, "..", "..");
const SCANNED_DIRS = ["app", "components"];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : sourceFiles(path);
    }

    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });

// The text of the last <Button ...> opening tag before `index`.
const buttonTagBefore = (source: string, index: number): string => {
  const start = source.lastIndexOf("<Button", index);
  const end = source.indexOf(">", start);

  return source.slice(start, end + 1);
};

const editButtons = SCANNED_DIRS.flatMap((dir) =>
  sourceFiles(join(ROOT, dir)).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    const buttons: { file: string; tag: string }[] = [];
    let index = source.indexOf("<PencilSquareIcon");

    while (index !== -1) {
      buttons.push({
        file: relative(ROOT, path).split(sep).join("/"),
        tag: buttonTagBefore(source, index),
      });
      index = source.indexOf("<PencilSquareIcon", index + 1);
    }

    return buttons;
  }),
);

describe("edit buttons", () => {
  it("are found where the tables and lists have them", () => {
    expect(editButtons.length).toBeGreaterThanOrEqual(4);
  });

  it.each(editButtons.map(({ file, tag }) => [file, tag]))(
    "%s: the pencil button is a secondary button",
    (_file, tag) => {
      expect(tag).toContain('variant="secondary"');
    },
  );
});
