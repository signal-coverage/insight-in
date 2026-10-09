import { describe, expect, it, vi } from "vitest";

import {
  inLockOrder,
  lockAccount,
  lockAccounts,
  lockAccountsShared,
} from "./locks";

const USER_ID = "user_123";

describe("lockAccount", () => {
  it("locks the user's account row until the transaction ends, reading its currency and archive date", async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValue([
          { id: "acc_1", currency: "ARS", archivedAt: null },
        ]),
    };

    await expect(lockAccount(tx, USER_ID, "acc_1")).resolves.toEqual({
      id: "acc_1",
      currency: "ARS",
      archivedAt: null,
    });

    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?").replace(/\s+/g, " ").trim();

    expect(sql).toContain('FROM "Account"');
    expect(sql).toMatch(/FOR NO KEY UPDATE$/);
    expect(values).toEqual(["acc_1", USER_ID]);
  });

  it("is null for an account that is not the user's", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await expect(lockAccount(tx, USER_ID, "acc_x")).resolves.toBeNull();
  });
});

describe("inLockOrder", () => {
  it("sorts the ids ascending and drops duplicates, so every caller locks in the same order", () => {
    expect(inLockOrder(["acc_c", "acc_a", "acc_c", "acc_b"])).toEqual([
      "acc_a",
      "acc_b",
      "acc_c",
    ]);
  });

  it("does not change what it is given", () => {
    const ids = ["b", "a"];

    inLockOrder(ids);

    expect(ids).toEqual(["b", "a"]);
  });
});

describe("lockAccounts", () => {
  const accounts: Record<
    string,
    { id: string; currency: string; archivedAt: Date | null }
  > = {
    acc_a: { id: "acc_a", currency: "ARS", archivedAt: null },
    acc_b: { id: "acc_b", currency: "USD", archivedAt: null },
  };

  it("locks each account FOR NO KEY UPDATE, one after the other, in ascending id order whatever the order asked", async () => {
    const tx = {
      $queryRaw: vi.fn(
        async (_strings: TemplateStringsArray, ...values: unknown[]) => {
          const account = accounts[String(values[0])];

          return account ? [account] : [];
        },
      ),
    };

    const locked = await lockAccounts(tx as never, USER_ID, [
      "acc_b",
      "acc_a",
      "acc_b",
    ]);

    const calls = tx.$queryRaw.mock.calls as [
      TemplateStringsArray,
      ...unknown[],
    ][];

    expect(calls.map((call) => call[1])).toEqual(["acc_a", "acc_b"]);
    expect(calls.every((call) => call[2] === USER_ID)).toBe(true);
    expect([...locked.keys()]).toEqual(["acc_a", "acc_b"]);
    expect(locked.get("acc_b")).toEqual(accounts.acc_b);
  });

  it("leaves out an account that is not the user's", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    expect((await lockAccounts(tx, USER_ID, ["acc_x"])).size).toBe(0);
  });
});

describe("lockAccountsShared", () => {
  const sqlOf = (call: unknown[]): string =>
    (call[0] as TemplateStringsArray).join("?").replace(/\s+/g, " ").trim();

  it("takes a shared lock on each account, one after the other, in ascending id order, ids as parameters", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await lockAccountsShared(tx, USER_ID, ["acc_b", "acc_a", "acc_b"]);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.calls.map((call) => call[1])).toEqual([
      "acc_a",
      "acc_b",
    ]);
    for (const call of tx.$queryRaw.mock.calls) {
      expect(sqlOf(call)).toContain('FROM "Account"');
      expect(sqlOf(call)).toMatch(/FOR SHARE$/);
      expect(call[2]).toBe(USER_ID);
    }
  });

  it("locks nothing for no accounts", async () => {
    const tx = { $queryRaw: vi.fn() };

    await lockAccountsShared(tx, USER_ID, []);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("sequential locking", () => {
  const deferred = () => {
    let resolve!: (rows: unknown[]) => void;
    const promise = new Promise<unknown[]>((done) => {
      resolve = done;
    });

    return { promise, resolve };
  };

  it.each([
    ["lockAccounts", lockAccounts],
    ["lockAccountsShared", lockAccountsShared],
  ])(
    "%s asks for the second account only after the first lock was granted (no Promise.all on the transaction)",
    async (_name, lock) => {
      const first = deferred();
      const tx = {
        $queryRaw: vi
          .fn()
          .mockReturnValueOnce(first.promise)
          .mockResolvedValue([]),
      };

      const done = lock(tx as never, USER_ID, ["acc_b", "acc_a"]);

      await Promise.resolve();
      await Promise.resolve();

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

      first.resolve([]);
      await done;

      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    },
  );
});
