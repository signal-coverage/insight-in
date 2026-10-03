import { describe, expect, it } from "vitest";
import { parseArgs } from "./parseArgs.ts";

describe("parseArgs", () => {
  it("defaults every flag to off", () => {
    expect(parseArgs([])).toEqual({
      ok: true,
      args: {
        yes: false,
        dryRun: false,
        user: null,
        iKnowThisIsProduction: false,
        confirmDb: null,
      },
    });
  });

  it("reads the boolean flags", () => {
    const result = parseArgs([
      "--yes",
      "--dry-run",
      "--i-know-this-is-production",
    ]);
    expect(result).toMatchObject({
      ok: true,
      args: { yes: true, dryRun: true, iKnowThisIsProduction: true },
    });
  });

  it("reads --user and --confirm-db values", () => {
    const result = parseArgs(["--user=user_2abc", "--confirm-db=insight"]);
    expect(result).toMatchObject({
      ok: true,
      args: { user: "user_2abc", confirmDb: "insight" },
    });
  });

  it("keeps an equals sign inside a value", () => {
    expect(parseArgs(["--user=a=b"])).toMatchObject({
      ok: true,
      args: { user: "a=b" },
    });
  });

  it("rejects --user and --confirm-db without a value", () => {
    expect(parseArgs(["--user="])).toMatchObject({ ok: false });
    expect(parseArgs(["--user"])).toMatchObject({ ok: false });
    expect(parseArgs(["--confirm-db="])).toMatchObject({ ok: false });
  });

  it("rejects a value on a boolean flag", () => {
    expect(parseArgs(["--yes=true"])).toMatchObject({ ok: false });
  });

  it("rejects unknown flags and stray arguments instead of ignoring them", () => {
    expect(parseArgs(["--yess"])).toMatchObject({ ok: false });
    expect(parseArgs(["yes"])).toMatchObject({ ok: false });
  });
});
