import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ bank: { findMany: vi.fn() } }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { listBankChoices } from "./choices";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listBankChoices", () => {
  it("reads only the user's active banks, in the order of the Banks board", async () => {
    db.bank.findMany.mockResolvedValue([]);

    await listBankChoices("user_123");

    expect(db.bank.findMany).toHaveBeenCalledWith({
      where: { userId: "user_123", archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });

  it("returns each bank as its id and name", async () => {
    db.bank.findMany.mockResolvedValue([
      { id: "bank_1", name: "Banco Galicia" },
      { id: "bank_2", name: "AstroPay" },
    ]);

    await expect(listBankChoices("user_123")).resolves.toEqual([
      { id: "bank_1", name: "Banco Galicia" },
      { id: "bank_2", name: "AstroPay" },
    ]);
  });
});
