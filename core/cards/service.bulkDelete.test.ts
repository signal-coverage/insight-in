import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  card: { count: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { deleteCards } from "./service";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deleteCards", () => {
  it("deletes, in one statement and for the user only, the cards with nothing pending", async () => {
    db.card.count.mockResolvedValue(2);
    db.card.deleteMany.mockResolvedValue({ count: 2 });

    await expect(deleteCards(USER_ID, ["card_1", "card_2"])).resolves.toEqual({
      deleted: 2,
      skipped: 0,
    });
    expect(db.card.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.card.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["card_1", "card_2"] },
        userId: USER_ID,
        expenses: { none: { status: "PLANNED" } },
      },
    });
  });

  it("counts the user's cards among the ids, to know how many were left out", async () => {
    db.card.count.mockResolvedValue(0);
    db.card.deleteMany.mockResolvedValue({ count: 0 });

    await deleteCards(USER_ID, ["card_1"]);

    expect(db.card.count).toHaveBeenCalledWith({
      where: { id: { in: ["card_1"] }, userId: USER_ID },
    });
  });

  it("skips the cards that still have pending expenses and reports how many", async () => {
    db.card.count.mockResolvedValue(3);
    db.card.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      deleteCards(USER_ID, ["card_1", "card_2", "card_3"]),
    ).resolves.toEqual({ deleted: 1, skipped: 2 });
  });

  it("deletes nothing and skips everything when every card has pending expenses", async () => {
    db.card.count.mockResolvedValue(2);
    db.card.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCards(USER_ID, ["card_1", "card_2"])).resolves.toEqual({
      deleted: 0,
      skipped: 2,
    });
  });

  it("ignores ids that are not the user's: they are neither deleted nor skipped", async () => {
    db.card.count.mockResolvedValue(1);
    db.card.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteCards(USER_ID, ["card_1", "card_9"])).resolves.toEqual({
      deleted: 1,
      skipped: 0,
    });
  });

  it("never reports a negative number of skipped cards when one vanishes in between", async () => {
    db.card.count.mockResolvedValue(1);
    db.card.deleteMany.mockResolvedValue({ count: 2 });

    await expect(deleteCards(USER_ID, ["card_1", "card_2"])).resolves.toEqual({
      deleted: 2,
      skipped: 0,
    });
  });
});
