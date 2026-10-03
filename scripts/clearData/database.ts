export type DatabaseInfo = { host: string; database: string };

/**
 * Host and database name of a connection string. Credentials never leave this function, and an
 * unparseable value is not echoed (it may contain a password).
 */
export function describeDatabase(
  connectionString: string,
): DatabaseInfo | null {
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!url.hostname || !database) return null;
    return { host: url.hostname, database };
  } catch {
    return null;
  }
}
