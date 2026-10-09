import { describe, expect, it, vi } from "vitest";

import { lockBank, lockBankOfAccount } from "./locks";

const USER_ID = "user_123";
const AT = new Date("2026-10-04T12:00:00.000Z");

const fakeTx = (rows: unknown[]) => ({
  $queryRaw: vi.fn().mockResolvedValue(rows),
});

// The tagged template reaches the client as (strings, ...values).
const callOf = (tx: ReturnType<typeof fakeTx>) => {
  const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];

  return { sql: strings.join("?").replace(/\s+/g, " ").trim(), values };
};

describe("lockBank", () => {
  it("locks the user's bank row until the transaction ends, and reads whether it is archived and its kind", async () => {
    const tx = fakeTx([{ id: "bank_1", archivedAt: AT, kind: "WALLET" }]);

    await expect(lockBank(tx, USER_ID, "bank_1")).resolves.toEqual({
      id: "bank_1",
      archivedAt: AT,
      kind: "WALLET",
    });

    const { sql, values } = callOf(tx);

    expect(sql).toContain('FROM "Bank"');
    expect(sql).toContain('"kind"');
    expect(sql).toMatch(/FOR UPDATE$/);
    expect(values).toEqual(["bank_1", USER_ID]);
  });

  it("is null for a bank that is not the user's (or does not exist)", async () => {
    await expect(lockBank(fakeTx([]), USER_ID, "bank_x")).resolves.toBeNull();
  });

  it("never puts an id inside the SQL text", async () => {
    const tx = fakeTx([]);

    await lockBank(tx, USER_ID, 'bank\'; DROP TABLE "Bank"; --');

    expect(callOf(tx).sql).not.toContain("DROP");
  });
});

describe("lockBankOfAccount", () => {
  it("locks the bank row of the user's account", async () => {
    const tx = fakeTx([{ id: "bank_1", archivedAt: null, kind: "ENTITY" }]);

    await expect(lockBankOfAccount(tx, USER_ID, "acc_1")).resolves.toEqual({
      id: "bank_1",
      archivedAt: null,
      kind: "ENTITY",
    });

    const { sql, values } = callOf(tx);

    expect(sql).toContain('b."kind"');
    expect(sql).toContain('JOIN "Account"');
    expect(sql).toMatch(/FOR UPDATE OF b$/);
    expect(values).toEqual(["acc_1", USER_ID, USER_ID]);
  });

  it("is null for an account that is not the user's", async () => {
    await expect(
      lockBankOfAccount(fakeTx([]), USER_ID, "acc_x"),
    ).resolves.toBeNull();
  });
});
