import {
  CLEAR_ORDER,
  buildCountQuery,
  buildDeleteQuery,
  type ClearTable,
} from "./tables.ts";

/** The slice of a pg-style single connection this tool needs; tests inject a mock. */
export type SqlClient = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
};

export type TableRows = { table: ClearTable; rows: number };

export async function countRows(
  client: SqlClient,
  userId: string | null,
): Promise<TableRows[]> {
  const counts: TableRows[] = [];
  for (const table of CLEAR_ORDER) {
    const { text, values } = buildCountQuery(table, userId);
    const result = await client.query(text, values);
    counts.push({ table, rows: Number(result.rows[0]?.count ?? 0) });
  }
  return counts;
}

/** Deletes every table in dependency order inside ONE transaction; any failure rolls it all back. */
export async function executeClear(
  client: SqlClient,
  userId: string | null,
): Promise<TableRows[]> {
  const deleted: TableRows[] = [];
  await client.query("BEGIN");
  try {
    for (const table of CLEAR_ORDER) {
      const { text, values } = buildDeleteQuery(table, userId);
      const result = await client.query(text, values);
      deleted.push({ table, rows: result.rowCount ?? 0 });
    }
    await client.query("COMMIT");
  } catch (error) {
    // A failing ROLLBACK must not hide the original error (the server rolls back on close anyway).
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  return deleted;
}
