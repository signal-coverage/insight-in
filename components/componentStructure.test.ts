import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Every component follows the same layout (see the react-component-structure skill): the `.tsx`
// holds rendering and local state only. Types go in `types.ts`, constants in `consts.ts`, styles in
// `styles.ts`, helpers in `utils.ts`, and a component that renders another distinct piece of UI
// gives it its own folder under `components/`, with the same rules all the way down.
// This guard fails when a component file declares a type, a constant, a helper or a second
// component at module level, types its props inline, carries a long class string, or sits in the
// wrong place, so the layout cannot quietly erode.

const ROOT = join(__dirname, "..");
const SCANNED_DIRS = ["components", "app"];
// `components/ui` holds ported library primitives (several tiny components per file by design).
const SKIPPED_DIRS = new Set(["node_modules", "generated", "ui"]);
// Next.js route files export framework-defined values (`metadata`) and may hold one component each.
const ROUTE_FILE = /(^|\/)(page|layout|loading|error|not-found)\.tsx$/;
const ROUTE_EXPORTS = new Set(["metadata", "viewport"]);
// A class string this long is a style, not a one-off tweak: it belongs in `styles.ts`.
const LONG_CLASS_NAME = /className="[^"]{40,}"/;

const componentFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : componentFiles(path);
    }

    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });

interface Finding {
  file: string;
  problem: string;
}

const isComponentName = (name: string): boolean => /^[A-Z]/.test(name);

const toPosix = (path: string): string =>
  relative(ROOT, path).split(sep).join("/");

const findingsFor = (file: string): Finding[] => {
  const path = toPosix(file);
  const lines = readFileSync(file, "utf8").split("\n");
  const isRoute = ROUTE_FILE.test(path);
  const findings: Finding[] = [];
  const components: string[] = [];

  lines.forEach((line, index) => {
    const at = `${path}:${index + 1}`;
    const isComment = /^\s*(\/\/|\*|\/\*)/.test(line);

    if (/^(export\s+)?(interface|type|enum)\s+\w+/.test(line)) {
      findings.push({
        file: at,
        problem: `type declared in the component file: ${line.trim()}`,
      });
    }

    if (!isComment && /\}: \{/.test(line)) {
      findings.push({
        file: at,
        problem: "props typed inline: name the type in types.ts",
      });
    }

    if (!isComment && LONG_CLASS_NAME.test(line)) {
      findings.push({
        file: at,
        problem: "long class string inline: move it to styles.ts",
      });
    }

    const constant = line.match(/^(?:export\s+)?const\s+(\w+)/);

    if (constant) {
      const [, name] = constant;
      // A component declared as an arrow function: `const Name = (...) =>` or `= function`.
      const declaration = `${line} ${lines[index + 1] ?? ""}`;

      if (isComponentName(name) && /=>|function/.test(declaration)) {
        components.push(name);
      } else if (!(isRoute && ROUTE_EXPORTS.has(name))) {
        findings.push({
          file: at,
          problem: `constant or helper at module level: ${name}`,
        });
      }
    }

    const declared = line.match(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/,
    );

    if (declared) {
      const [, name] = declared;

      if (isComponentName(name)) {
        components.push(name);
      } else if (!/^use[A-Z]/.test(name) && !/^generate[A-Z]/.test(name)) {
        findings.push({
          file: at,
          problem: `helper function at module level: ${name}`,
        });
      }
    }
  });

  if (components.length > 1 && !isRoute) {
    findings.push({
      file: path,
      problem: `more than one component in the file (${components.join(", ")}): the others belong in components/`,
    });
  }

  return findings;
};

// Where a component file lives: sub-components are always folders, never bare files, and a
// component's folder exposes it through an `index.ts`.
const placementFindingsFor = (file: string): Finding[] => {
  const path = toPosix(file);

  if (ROUTE_FILE.test(path)) return [];

  const folder = dirname(file);
  const findings: Finding[] = [];
  const isNestedComponentsFolder =
    basename(folder) === "components" &&
    dirname(folder) !== join(ROOT, "components");

  if (isNestedComponentsFolder) {
    findings.push({
      file: path,
      problem:
        "a sub-component is a bare file under components/: give it its own folder",
    });
  }

  const name = basename(file, ".tsx");

  if (basename(folder) === name && !existsSync(join(folder, "index.ts"))) {
    findings.push({
      file: path,
      problem: "the component's folder has no index.ts",
    });
  }

  return findings;
};

describe("component structure", () => {
  const files = SCANNED_DIRS.flatMap((dir) => componentFiles(join(ROOT, dir)));

  it("scans the component files of the app", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it("keeps types, constants, helpers and extra components out of every component file", () => {
    const findings = files.flatMap(findingsFor);

    expect(findings.map(({ file, problem }) => `${file} - ${problem}`)).toEqual(
      [],
    );
  });

  it("gives every sub-component its own folder, and every component folder an index.ts", () => {
    const findings = files.flatMap(placementFindingsFor);

    expect(findings.map(({ file, problem }) => `${file} - ${problem}`)).toEqual(
      [],
    );
  });
});
