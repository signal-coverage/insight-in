import type { DatabaseInfo } from "./database.ts";
import type { ClearArgs } from "./parseArgs.ts";

export const NOTHING_DELETED_MESSAGE =
  "Nada se borró. Corré de nuevo con --yes para confirmar.";

export type PreflightDecision =
  { proceed: true } | { proceed: false; exitCode: 1; message: string };

export function looksLikeProduction(database: DatabaseInfo): boolean {
  return /prod/i.test(database.host) || /prod/i.test(database.database);
}

/** Everything that can be decided without opening a connection: refusals come first. */
export function decideBeforeConnecting(input: {
  args: ClearArgs;
  nodeEnv: string | undefined;
  database: DatabaseInfo | null;
}): PreflightDecision {
  const { args, nodeEnv, database } = input;

  if (nodeEnv === "production") {
    return {
      proceed: false,
      exitCode: 1,
      message:
        "Me niego: NODE_ENV=production. Este comando nunca corre en producción.",
    };
  }

  if (!database) {
    return {
      proceed: false,
      exitCode: 1,
      message: "Me niego: no pude leer host y base de DATABASE_URL.",
    };
  }

  if (looksLikeProduction(database)) {
    if (!args.iKnowThisIsProduction) {
      return {
        proceed: false,
        exitCode: 1,
        message:
          `Me niego: ${database.host}/${database.database} parece producción ("prod" en el host o la base). ` +
          `Si de verdad es lo que querés, agregá --i-know-this-is-production --confirm-db=${database.database}.`,
      };
    }
    if (args.confirmDb !== database.database) {
      return {
        proceed: false,
        exitCode: 1,
        message:
          `Me niego: para borrar en una base que parece producción tenés que escribir su nombre exacto: ` +
          `--confirm-db=${database.database}.`,
      };
    }
  }

  return { proceed: true };
}

export type PostCountDecision =
  { action: "delete" } | { action: "stop"; exitCode: 0 | 1; message: string };

/** After the counts were shown: delete only with --yes, and --dry-run always wins. */
export function decideAfterCounting(args: ClearArgs): PostCountDecision {
  if (args.dryRun) {
    return {
      action: "stop",
      exitCode: 0,
      message: "Dry run: no se borró nada.",
    };
  }
  if (!args.yes) {
    return { action: "stop", exitCode: 1, message: NOTHING_DELETED_MESSAGE };
  }
  return { action: "delete" };
}
