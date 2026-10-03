export type ClearArgs = {
  yes: boolean;
  dryRun: boolean;
  /** Clerk user id: wipe only this user's rows. */
  user: string | null;
  iKnowThisIsProduction: boolean;
  /** The database name typed by the human, required to override the production guard. */
  confirmDb: string | null;
};

export type ParsedArgs =
  { ok: true; args: ClearArgs } | { ok: false; message: string };

const BOOLEAN_FLAGS = {
  "--yes": "yes",
  "--dry-run": "dryRun",
  "--i-know-this-is-production": "iKnowThisIsProduction",
} as const;

const VALUE_FLAGS = {
  "--user": "user",
  "--confirm-db": "confirmDb",
} as const;

/** Strict: unknown flags and stray arguments fail instead of being ignored (a typo must not delete). */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const args: ClearArgs = {
    yes: false,
    dryRun: false,
    user: null,
    iKnowThisIsProduction: false,
    confirmDb: null,
  };

  for (const raw of argv) {
    const equals = raw.indexOf("=");
    const flag = equals === -1 ? raw : raw.slice(0, equals);
    const value = equals === -1 ? null : raw.slice(equals + 1);

    if (flag in BOOLEAN_FLAGS) {
      if (value !== null)
        return { ok: false, message: `${flag} no lleva valor.` };
      args[BOOLEAN_FLAGS[flag as keyof typeof BOOLEAN_FLAGS]] = true;
    } else if (flag in VALUE_FLAGS) {
      if (!value)
        return {
          ok: false,
          message: `${flag} necesita un valor: ${flag}=<valor>.`,
        };
      args[VALUE_FLAGS[flag as keyof typeof VALUE_FLAGS]] = value;
    } else {
      return { ok: false, message: `Argumento desconocido: ${raw}` };
    }
  }

  return { ok: true, args };
}
