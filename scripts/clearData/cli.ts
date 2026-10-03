import { describeDatabase } from "./database.ts";
import { decideAfterCounting, decideBeforeConnecting } from "./decide.ts";
import {
  countRows,
  executeClear,
  type SqlClient,
  type TableRows,
} from "./execute.ts";
import { parseArgs } from "./parseArgs.ts";

export type ClearDataDeps = {
  argv: readonly string[];
  env: Record<string, string | undefined>;
  log: (line: string) => void;
  /** Opens one connection; the caller closes it through `close`. */
  connect: (
    connectionString: string,
  ) => Promise<{ client: SqlClient; close: () => Promise<void> }>;
};

function formatTable(title: string, rows: TableRows[]): string[] {
  const width = Math.max(...rows.map((entry) => entry.table.length));
  const lines = rows.map(
    (entry) => `  ${entry.table.padEnd(width)}  ${entry.rows}`,
  );
  const total = rows.reduce((sum, entry) => sum + entry.rows, 0);
  return [title, ...lines, `  ${"TOTAL".padEnd(width)}  ${total}`];
}

/** Returns the process exit code. Nothing is deleted unless every guard passes and --yes is given. */
export async function runClearData(deps: ClearDataDeps): Promise<number> {
  const { log } = deps;

  const parsed = parseArgs(deps.argv);
  if (!parsed.ok) {
    log(parsed.message);
    return 2;
  }
  const { args } = parsed;

  const connectionString = deps.env.DATABASE_URL;
  if (!connectionString) {
    log("Falta DATABASE_URL (.env.local o variable de entorno).");
    return 1;
  }

  const database = describeDatabase(connectionString);
  if (database) {
    log(`Base: ${database.host} / ${database.database}`);
  }
  log(
    args.user
      ? `Alcance: solo el usuario ${args.user}`
      : "Alcance: TODOS los datos de la app",
  );

  const preflight = decideBeforeConnecting({
    args,
    nodeEnv: deps.env.NODE_ENV,
    database,
  });
  if (!preflight.proceed) {
    log(preflight.message);
    return preflight.exitCode;
  }

  const { client, close } = await deps.connect(connectionString);
  try {
    const counts = await countRows(client, args.user);
    log(formatTable("Filas actuales:", counts).join("\n"));

    const decision = decideAfterCounting(args);
    if (decision.action === "stop") {
      log(decision.message);
      return decision.exitCode;
    }

    const deleted = await executeClear(client, args.user);
    log(formatTable("Filas borradas:", deleted).join("\n"));
    log("Listo. Los usuarios de Clerk no se tocan (viven en Clerk).");
    return 0;
  } catch (error) {
    log(
      `Falló y se hizo rollback: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  } finally {
    await close();
  }
}
