import { describe, expect, it } from "vitest";
import { runClearData, type ClearDataDeps } from "./cli.ts";
import type { SqlClient } from "./execute.ts";
import { CLEAR_ORDER } from "./tables.ts";

const URL_DEV =
  "postgresql://owner:s3cr3t@ep-dev-1.neon.tech/neondb?sslmode=require";

function setup(
  argv: string[],
  env: Record<string, string | undefined> = { DATABASE_URL: URL_DEV },
  counts: Record<string, number> = { Expense: 4, Income: 2 },
) {
  const out: string[] = [];
  const queries: string[] = [];
  let connected = 0;
  let closed = 0;
  const client: SqlClient = {
    async query(text) {
      queries.push(text);
      const table = /FROM "(\w+)"/.exec(text)?.[1] ?? "";
      if (text.startsWith("SELECT COUNT")) {
        return { rows: [{ count: String(counts[table] ?? 0) }], rowCount: 1 };
      }
      if (text.startsWith("DELETE"))
        return { rows: [], rowCount: counts[table] ?? 0 };
      return { rows: [], rowCount: null };
    },
  };
  const deps: ClearDataDeps = {
    argv,
    env,
    log: (line) => out.push(line),
    async connect() {
      connected += 1;
      return {
        client,
        async close() {
          closed += 1;
        },
      };
    },
  };
  return { deps, out, queries, state: () => ({ connected, closed }) };
}

const text = (out: string[]) => out.join("\n");

describe("runClearData", () => {
  it("without --yes prints target and counts, deletes nothing and exits 1", async () => {
    const { deps, out, queries } = setup([]);

    const code = await runClearData(deps);

    expect(code).toBe(1);
    expect(text(out)).toContain("ep-dev-1.neon.tech");
    expect(text(out)).toContain("neondb");
    expect(text(out)).toContain(
      "Nada se borró. Corré de nuevo con --yes para confirmar.",
    );
    expect(text(out)).not.toContain("s3cr3t");
    expect(queries.some((q) => q.startsWith("DELETE") || q === "BEGIN")).toBe(
      false,
    );
  });

  it("--dry-run prints what would be deleted and exits 0 without deleting", async () => {
    const { deps, out, queries } = setup(["--dry-run", "--yes"]);

    const code = await runClearData(deps);

    expect(code).toBe(0);
    expect(text(out)).toMatch(/Expense\s+4/);
    expect(queries.some((q) => q.startsWith("DELETE") || q === "BEGIN")).toBe(
      false,
    );
  });

  it("--yes deletes in one transaction and prints the rows deleted per table", async () => {
    const { deps, out, queries, state } = setup(["--yes"]);

    const code = await runClearData(deps);

    expect(code).toBe(0);
    expect(queries.filter((q) => q === "BEGIN")).toHaveLength(1);
    expect(queries.filter((q) => q === "COMMIT")).toHaveLength(1);
    expect(queries.filter((q) => q.startsWith("DELETE"))).toHaveLength(
      CLEAR_ORDER.length,
    );
    expect(text(out)).toMatch(/Expense\s+4/);
    expect(text(out)).not.toContain("s3cr3t");
    expect(state()).toEqual({ connected: 1, closed: 1 });
  });

  it("--user shows the user in the output and scopes the work", async () => {
    const { deps, out, queries } = setup(["--yes", "--user=user_9"]);

    const code = await runClearData(deps);

    expect(code).toBe(0);
    expect(text(out)).toContain("user_9");
    expect(
      queries
        .filter((q) => q.startsWith("DELETE"))
        .every((q) => q.includes("$1")),
    ).toBe(true);
  });

  it("refuses in production before ever connecting", async () => {
    const { deps, out, state } = setup(["--yes"], {
      DATABASE_URL: URL_DEV,
      NODE_ENV: "production",
    });

    expect(await runClearData(deps)).toBe(1);
    expect(state().connected).toBe(0);
    expect(text(out)).toMatch(/NODE_ENV=production/);
  });

  it("refuses a production-looking host before connecting", async () => {
    const { deps, state } = setup(["--yes"], {
      DATABASE_URL: "postgresql://o:p@ep-prod-9.neon.tech/neondb",
    });

    expect(await runClearData(deps)).toBe(1);
    expect(state().connected).toBe(0);
  });

  it("fails clearly when DATABASE_URL is missing", async () => {
    const { deps, out, state } = setup(["--yes"], {});

    expect(await runClearData(deps)).toBe(1);
    expect(state().connected).toBe(0);
    expect(text(out)).toContain("DATABASE_URL");
  });

  it("fails on bad arguments with exit code 2 and without connecting", async () => {
    const { deps, state } = setup(["--yess"]);

    expect(await runClearData(deps)).toBe(2);
    expect(state().connected).toBe(0);
  });

  it("closes the connection and exits 1 when the transaction fails", async () => {
    const { deps, out } = setup(["--yes"]);
    let closed = 0;
    const failing: ClearDataDeps = {
      ...deps,
      async connect() {
        return {
          client: {
            async query(sql: string) {
              if (sql.startsWith("SELECT COUNT"))
                return { rows: [{ count: "1" }], rowCount: 1 };
              if (sql.startsWith('DELETE FROM "Card"')) throw new Error("boom");
              return { rows: [], rowCount: 0 };
            },
          },
          async close() {
            closed += 1;
          },
        };
      },
    };

    expect(await runClearData(failing)).toBe(1);
    expect(text(out)).toContain("boom");
    expect(closed).toBe(1);
  });
});
