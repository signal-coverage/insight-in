import { describe, expect, it, vi } from "vitest";

import { lockTransfers } from "./locks";

const USER_ID = "user_123";

describe("lockTransfers", () => {
  it("locks the user's transfer rows in id order in one statement, ids and owner as parameters", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "tr_1" }, { id: "tr_2" }]),
    };

    await expect(
      lockTransfers(tx, USER_ID, ["tr_2", "tr_1"]),
    ).resolves.toBeUndefined();

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join("?").replace(/\s+/g, " ").trim();

    expect(sql).toContain('FROM "Transfer"');
    expect(sql).toContain('"userId" = ?');
    expect(sql).toContain("ANY(?)");
    expect(sql).toMatch(/ORDER BY "id" FOR UPDATE$/);
    expect(sql).not.toContain("tr_1");
    expect(sql).not.toContain(USER_ID);
    expect(values).toEqual([["tr_2", "tr_1"], USER_ID]);
  });

  it("drops duplicate ids", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };

    await lockTransfers(tx, USER_ID, ["tr_1", "tr_1"]);

    const values = (tx.$queryRaw.mock.calls[0] as unknown[]).slice(1);

    expect(values).toEqual([["tr_1"], USER_ID]);
  });

  it("issues no query for an empty list of ids", async () => {
    const tx = { $queryRaw: vi.fn() };

    await lockTransfers(tx, USER_ID, []);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
