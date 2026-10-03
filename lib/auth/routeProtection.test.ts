import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const DASHBOARD_DIR = join(ROOT, "app", "dashboard");

// Next re-renders these per request or per navigation independently, so each one must check the
// session itself (a layout check alone is not enough: layouts are not re-rendered on client
// navigation between pages). `loading.tsx` and `error.tsx` never load protected data.
const GUARDED_FILE = /^(page|layout|template|default)\.(tsx|ts|jsx|js)$/;

const collectGuardedFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectGuardedFiles(path);
    }

    return GUARDED_FILE.test(entry.name) ? [path] : [];
  });

const label = (path: string) => relative(ROOT, path).replaceAll("\\", "/");

describe("dashboard route protection", () => {
  const files = collectGuardedFiles(DASHBOARD_DIR);

  it("finds the dashboard layout and pages", () => {
    const labels = files.map(label);

    expect(labels).toContain("app/dashboard/layout.tsx");
    expect(labels).toContain("app/dashboard/page.tsx");
    expect(labels).toContain("app/dashboard/incomes/page.tsx");
  });

  it("checks the session in every page, layout, template and default under app/dashboard", () => {
    const offenders = files
      .filter((path) => !readFileSync(path, "utf8").includes("requireUserId"))
      .map(label);

    expect(
      offenders,
      `Missing requireUserId(): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps those files as Server Components so the check runs on the server", () => {
    const clientFiles = files
      .filter((path) =>
        /^\s*["']use client["']/.test(readFileSync(path, "utf8")),
      )
      .map(label);

    expect(
      clientFiles,
      `Client Components cannot call requireUserId(): ${clientFiles.join(", ")}`,
    ).toEqual([]);
  });
});

describe("proxy.ts", () => {
  const proxy = readFileSync(join(ROOT, "proxy.ts"), "utf8");

  it("no longer uses the deprecated createRouteMatcher", () => {
    expect(proxy).not.toContain("createRouteMatcher");
    expect(proxy).not.toContain("auth.protect");
  });

  it("still runs clerkMiddleware on every route with the root sign-in URL", () => {
    expect(proxy).toContain("clerkMiddleware(");
    expect(proxy).toContain('signInUrl: "/"');
    expect(proxy).toContain('"/(api|trpc)(.*)"');
    expect(proxy).toContain('"/__clerk/(.*)"');
  });
});
