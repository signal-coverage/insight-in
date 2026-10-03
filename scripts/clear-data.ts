/**
 * Wipes the app data of the database in DATABASE_URL (the Clerk users live in Clerk and are not
 * touched; neither are the schema nor `_prisma_migrations`).
 *
 *   npm run db:clear                     shows the database and the row counts; deletes NOTHING (exit 1)
 *   npm run db:clear -- --dry-run        same, but exits 0 ("this is what would be deleted")
 *   npm run db:clear -- --yes            deletes every row of every app table, in ONE transaction
 *   npm run db:clear -- --user=<id>      with --yes: deletes only that Clerk user's rows
 *
 * Refuses when NODE_ENV=production, or when the host or database name contains "prod" unless
 * `--i-know-this-is-production --confirm-db=<exact database name>` are both given.
 *
 * Runs with Node's built-in type stripping (no tsx): relative imports keep their `.ts` extension
 * and only erasable TypeScript syntax is used. The logic lives in ./clearData (pure + tested).
 */
import { neonConfig, Pool } from "@neondatabase/serverless";
import dotenv from "dotenv";
import ws from "ws";
import { runClearData } from "./clearData/cli.ts";

// Same files and priority as prisma.config.ts / Next: a variable already in the shell wins.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

neonConfig.webSocketConstructor = ws;

const exitCode = await runClearData({
  argv: process.argv.slice(2),
  env: process.env,
  log: (line) => console.log(line),
  async connect(connectionString) {
    const pool = new Pool({ connectionString });
    const client = await pool.connect();
    return {
      client,
      async close() {
        client.release();
        await pool.end();
      },
    };
  },
});

process.exitCode = exitCode;
