import { describe, expect, it } from "vitest";
import type { ClearArgs } from "./parseArgs.ts";
import { decideBeforeConnecting, decideAfterCounting } from "./decide.ts";

const args = (overrides: Partial<ClearArgs> = {}): ClearArgs => ({
  yes: false,
  dryRun: false,
  user: null,
  iKnowThisIsProduction: false,
  confirmDb: null,
  ...overrides,
});

const DEV = { host: "ep-dev-1.neon.tech", database: "neondb" };

describe("decideBeforeConnecting", () => {
  it("refuses when DATABASE_URL could not be understood", () => {
    const decision = decideBeforeConnecting({
      args: args(),
      nodeEnv: undefined,
      database: null,
    });
    expect(decision).toMatchObject({ proceed: false, exitCode: 1 });
  });

  it("refuses when NODE_ENV is production, even with every override", () => {
    const decision = decideBeforeConnecting({
      args: args({
        yes: true,
        iKnowThisIsProduction: true,
        confirmDb: "neondb",
      }),
      nodeEnv: "production",
      database: DEV,
    });
    expect(decision).toMatchObject({ proceed: false, exitCode: 1 });
    expect(decision.proceed === false && decision.message).toMatch(
      /NODE_ENV=production/,
    );
  });

  it.each([
    [{ host: "ep-prod-1.neon.tech", database: "neondb" }],
    [{ host: "ep-dev-1.neon.tech", database: "insight_PROD" }],
  ])("refuses a production-looking database %j", (database) => {
    const decision = decideBeforeConnecting({
      args: args({ yes: true }),
      nodeEnv: "development",
      database,
    });
    expect(decision).toMatchObject({ proceed: false, exitCode: 1 });
  });

  it("refuses --i-know-this-is-production without --confirm-db", () => {
    const decision = decideBeforeConnecting({
      args: args({ yes: true, iKnowThisIsProduction: true }),
      nodeEnv: undefined,
      database: { host: "ep-prod-1.neon.tech", database: "neondb" },
    });
    expect(decision).toMatchObject({ proceed: false });
    expect(decision.proceed === false && decision.message).toMatch(
      /--confirm-db=neondb/,
    );
  });

  it("refuses --i-know-this-is-production when the typed name is wrong", () => {
    const decision = decideBeforeConnecting({
      args: args({ iKnowThisIsProduction: true, confirmDb: "other" }),
      nodeEnv: undefined,
      database: { host: "ep-prod-1.neon.tech", database: "neondb" },
    });
    expect(decision).toMatchObject({ proceed: false });
  });

  it("allows a production-looking database only with the flag and the exact name", () => {
    const decision = decideBeforeConnecting({
      args: args({ iKnowThisIsProduction: true, confirmDb: "neondb" }),
      nodeEnv: undefined,
      database: { host: "ep-prod-1.neon.tech", database: "neondb" },
    });
    expect(decision).toEqual({ proceed: true });
  });

  it("allows a dev database", () => {
    expect(
      decideBeforeConnecting({
        args: args(),
        nodeEnv: "development",
        database: DEV,
      }),
    ).toEqual({ proceed: true });
  });
});

describe("decideAfterCounting", () => {
  it("does nothing without --yes and exits with 1 and the Spanish message", () => {
    expect(decideAfterCounting(args())).toEqual({
      action: "stop",
      exitCode: 1,
      message: "Nada se borró. Corré de nuevo con --yes para confirmar.",
    });
  });

  it("--dry-run exits 0 without deleting, even with --yes", () => {
    const decision = decideAfterCounting(args({ dryRun: true, yes: true }));
    expect(decision).toMatchObject({ action: "stop", exitCode: 0 });
  });

  it("--dry-run alone also exits 0", () => {
    expect(decideAfterCounting(args({ dryRun: true }))).toMatchObject({
      action: "stop",
      exitCode: 0,
    });
  });

  it("deletes only with --yes", () => {
    expect(decideAfterCounting(args({ yes: true }))).toEqual({
      action: "delete",
    });
  });
});
