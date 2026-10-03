import { describe, expect, it } from "vitest";
import { countRows, executeClear, type SqlClient } from "./execute.ts";
import { CLEAR_ORDER } from "./tables.ts";

type Call = { text: string; values: unknown[] };

function mockClient(
  options: { failOn?: string; counts?: Record<string, number> } = {},
) {
  const calls: Call[] = [];
  const client: SqlClient = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (options.failOn && text.includes(options.failOn))
        throw new Error("boom");
      const table = /FROM "(\w+)"/.exec(text)?.[1] ?? "";
      if (text.startsWith("SELECT COUNT")) {
        return {
          rows: [{ count: String(options.counts?.[table] ?? 0) }],
          rowCount: 1,
        };
      }
      if (text.startsWith("DELETE")) {
        return { rows: [], rowCount: options.counts?.[table] ?? 0 };
      }
      return { rows: [], rowCount: null };
    },
  };
  return { client, calls };
}

describe("countRows", () => {
  it("counts every table in the clear order", async () => {
    const { client, calls } = mockClient({ counts: { Expense: 7, Card: 2 } });
    const counts = await countRows(client, null);
    expect(counts.map((entry) => entry.table)).toEqual([...CLEAR_ORDER]);
    expect(counts.find((entry) => entry.table === "Expense")?.rows).toBe(7);
    expect(counts.find((entry) => entry.table === "Card")?.rows).toBe(2);
    expect(calls.every((call) => call.text.startsWith("SELECT COUNT"))).toBe(
      true,
    );
  });
});

describe("executeClear", () => {
  it("deletes every table in order inside ONE transaction and reports the rows", async () => {
    const { client, calls } = mockClient({ counts: { Income: 3, Expense: 5 } });

    const deleted = await executeClear(client, null);

    expect(calls[0].text).toBe("BEGIN");
    expect(calls.at(-1)?.text).toBe("COMMIT");
    expect(calls.filter((call) => call.text === "BEGIN")).toHaveLength(1);
    expect(calls.filter((call) => call.text === "COMMIT")).toHaveLength(1);
    expect(calls.some((call) => call.text === "ROLLBACK")).toBe(false);

    const deletes = calls.filter((call) => call.text.startsWith("DELETE"));
    expect(deletes.map((call) => /FROM "(\w+)"/.exec(call.text)?.[1])).toEqual([
      ...CLEAR_ORDER,
    ]);
    // Nothing runs outside the BEGIN...COMMIT window.
    expect(calls.slice(1, -1)).toEqual(deletes);

    expect(deleted.map((entry) => entry.table)).toEqual([...CLEAR_ORDER]);
    expect(deleted.find((entry) => entry.table === "Income")?.rows).toBe(3);
    expect(deleted.find((entry) => entry.table === "Expense")?.rows).toBe(5);
  });

  it("never touches the migrations table or the schema", async () => {
    const { client, calls } = mockClient();
    await executeClear(client, null);
    const sql = calls.map((call) => call.text).join("\n");
    expect(sql).not.toMatch(/_prisma_migrations|DROP|ALTER|TRUNCATE/i);
  });

  it("rolls back and rethrows when a delete fails, without committing", async () => {
    const { client, calls } = mockClient({ failOn: 'DELETE FROM "Card"' });

    await expect(executeClear(client, null)).rejects.toThrow("boom");

    expect(calls.at(-1)?.text).toBe("ROLLBACK");
    expect(calls.some((call) => call.text === "COMMIT")).toBe(false);
    // Stops at the failure: the tables after Card are never attempted.
    expect(calls.some((call) => call.text.includes('"OpeningBalance"'))).toBe(
      false,
    );
  });

  it("scopes every delete to the user when one is given", async () => {
    const { client, calls } = mockClient();

    await executeClear(client, "user_1");

    const deletes = calls.filter((call) => call.text.startsWith("DELETE"));
    expect(deletes).toHaveLength(CLEAR_ORDER.length);
    for (const call of deletes) {
      expect(call.text).toContain("$1");
      expect(call.values).toEqual(["user_1"]);
    }
  });
});
