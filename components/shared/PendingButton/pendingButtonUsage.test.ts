import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Every button that waits on something (a save, a delete, an add) must show it: a spinner and a
// "…ing" label. HeroUI's own `isPending` only blocks presses and shows nothing, so `PendingButton`
// wraps it with that behaviour as the default. This guard fails if anyone reaches for `isPending`
// on the raw HeroUI `Button`, which would quietly ship a button with no loading state.

const ROOT = join(__dirname, "..", "..", "..");
const SCANNED_DIRS = ["app", "components"];
// The one place allowed to pass `isPending` to HeroUI's Button: the wrapper itself.
const ALLOWED = ["components/shared/PendingButton/PendingButton.tsx"];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : sourceFiles(path);
    }

    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });

// True when the tag sets the `isPending` PROP (`isPending=...`); `isDisabled={isPending}` only reads
// a variable of that name and is fine.
const setsPendingProp = (tag: string): boolean => /\bisPending\s*=/.test(tag);

// The text of each raw `<Button ...>` opening tag, up to the end of its attributes.
const rawButtonTags = (source: string): string[] => {
  const tags: string[] = [];
  const opening = /<Button\b/g;
  let match: RegExpExecArray | null;

  while ((match = opening.exec(source))) {
    let depth = 0;
    let end = match.index;

    // Walk to the `>` that closes the tag, ignoring any `>` inside `{ ... }` expressions.
    for (let i = match.index; i < source.length; i += 1) {
      const char = source[i];

      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) {
        end = i;
        break;
      }
    }

    tags.push(source.slice(match.index, end + 1));
  }

  return tags;
};

describe("PendingButton usage guard", () => {
  const files = SCANNED_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));

  it("scans a meaningful number of source files", () => {
    // If the walk silently found nothing, the guard below would pass for the wrong reason.
    expect(files.length).toBeGreaterThan(40);
  });

  it("finds no raw HeroUI <Button isPending>: use PendingButton instead", () => {
    const offenders = files
      .filter(
        (file) => !ALLOWED.includes(relative(ROOT, file).split(sep).join("/")),
      )
      .filter((file) =>
        rawButtonTags(readFileSync(file, "utf8")).some(setsPendingProp),
      )
      .map((file) => relative(ROOT, file).split(sep).join("/"));

    expect(offenders).toEqual([]);
  });

  it("detects the pattern it forbids (so a green result means something)", () => {
    const bad = `<Button variant="danger" isPending={isPending} onPress={() => go()}>x</Button>`;
    const good = `<PendingButton isPending={isPending} label="x" />`;

    const disabledWhilePending = `<Button slot="close" isDisabled={isPending}>x</Button>`;

    expect(rawButtonTags(bad).some(setsPendingProp)).toBe(true);
    expect(rawButtonTags(good)).toEqual([]);
    // Reading the word `isPending` to disable a button is fine: only SETTING the prop is not.
    expect(rawButtonTags(disabledWhilePending).some(setsPendingProp)).toBe(
      false,
    );
  });
});
