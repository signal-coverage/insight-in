import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are observed
  // on the same mocks.
  $transaction: vi.fn(),
  boardItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { BoardItemNotFoundError } from "./errors";
import {
  createItem,
  deleteItem,
  listBoard,
  moveItem,
  updateItem,
} from "./service";

const { boardItem } = db;

const USER_ID = "user_123";

const row = (
  id: string,
  status: string,
  position: number,
  patch: Record<string, unknown> = {},
) => ({
  id,
  userId: USER_ID,
  title: `Item ${id}`,
  description: null,
  status,
  position,
  // 02:00 UTC of the 5th is still the 4th in Argentina (UTC-3).
  createdAt: new Date("2026-10-05T02:00:00.000Z"),
  updatedAt: new Date("2026-10-05T02:00:00.000Z"),
  ...patch,
});

// The neighbours the service reads inside a transaction: only the id and the position.
const sibling = (id: string, position: number) => ({ id, position });

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  boardItem.findMany.mockResolvedValue([]);
  boardItem.findFirst.mockResolvedValue({ id: "x" });
  boardItem.updateMany.mockResolvedValue({ count: 1 });
  boardItem.deleteMany.mockResolvedValue({ count: 1 });
  boardItem.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) =>
      row("new", data.status as string, data.position as number, data),
  );
});

describe("listBoard", () => {
  it("reads only the user's cards, ordered by position", async () => {
    await listBoard(USER_ID);

    expect(boardItem.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
  });

  it("groups the cards by column, in the order they came", async () => {
    boardItem.findMany.mockResolvedValue([
      row("a", "TODO", 1),
      row("b", "IDEA", 2),
      row("c", "TODO", 3),
    ]);

    const board = await listBoard(USER_ID);

    expect(board.TODO.map((item) => item.id)).toEqual(["a", "c"]);
    expect(board.IDEA.map((item) => item.id)).toEqual(["b"]);
    expect(board.DONE).toEqual([]);
    expect(board.DEPLOYED).toEqual([]);
  });

  it("gives every column even for a user without cards", async () => {
    const board = await listBoard(USER_ID);

    expect(Object.keys(board)).toEqual(["IDEA", "TODO", "DONE", "DEPLOYED"]);
  });

  it("gives the creation day in Argentina, not the UTC one, and nothing of the owner", async () => {
    boardItem.findMany.mockResolvedValue([
      row("a", "IDEA", 1, { description: "Algo" }),
    ]);

    const board = await listBoard(USER_ID);

    expect(board.IDEA[0]).toEqual({
      id: "a",
      title: "Item a",
      description: "Algo",
      status: "IDEA",
      position: 1,
      createdAt: "2026-10-04",
    });
  });
});

describe("createItem", () => {
  const input = {
    title: "Dark mode",
    description: null,
    status: "TODO" as const,
  };

  it("reads the column of the user it creates in, in order", async () => {
    await createItem(USER_ID, input);

    expect(boardItem.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "TODO" },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true },
    });
  });

  it("starts an empty column at the first step", async () => {
    await createItem(USER_ID, input);

    expect(boardItem.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        title: "Dark mode",
        description: null,
        status: "TODO",
        position: 1024,
      },
    });
  });

  it("appends at the end of the column when no index is given", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 1024),
      sibling("b", 2048),
    ]);

    await createItem(USER_ID, input);

    expect(boardItem.create.mock.calls[0][0].data.position).toBe(3072);
  });

  it("takes the midpoint of its neighbours at a given index", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 1024),
      sibling("b", 2048),
    ]);

    await createItem(USER_ID, { ...input, index: 1 });

    expect(boardItem.create.mock.calls[0][0].data.position).toBe(1536);
  });

  it("goes before the first card at index 0", async () => {
    boardItem.findMany.mockResolvedValue([sibling("a", 1024)]);

    await createItem(USER_ID, { ...input, index: 0 });

    expect(boardItem.create.mock.calls[0][0].data.position).toBe(0);
  });

  it("clamps an index past the end to the end", async () => {
    boardItem.findMany.mockResolvedValue([sibling("a", 1024)]);

    await createItem(USER_ID, { ...input, index: 50 });

    expect(boardItem.create.mock.calls[0][0].data.position).toBe(2048);
  });

  it("numbers the column again first when the gap at the index has collapsed", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 1),
      sibling("b", 1 + 1e-9),
      sibling("c", 5),
    ]);

    await createItem(USER_ID, { ...input, index: 1 });

    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "a", userId: USER_ID },
      data: { position: 1024 },
    });
    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "b", userId: USER_ID },
      data: { position: 2048 },
    });
    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "c", userId: USER_ID },
      data: { position: 3072 },
    });
    // Between the renumbered a (1024) and b (2048).
    expect(boardItem.create.mock.calls[0][0].data.position).toBe(1536);
  });

  it("does not renumber a column whose gaps are fine", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 1024),
      sibling("b", 2048),
    ]);

    await createItem(USER_ID, { ...input, index: 1 });

    expect(boardItem.updateMany).not.toHaveBeenCalled();
  });

  it("does it all in one transaction", async () => {
    await createItem(USER_ID, input);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("gives the created card back, with its day in Argentina", async () => {
    const created = await createItem(USER_ID, input);

    expect(created).toMatchObject({
      id: "new",
      title: "Dark mode",
      status: "TODO",
      position: 1024,
      createdAt: "2026-10-04",
    });
  });
});

describe("updateItem", () => {
  it("changes only the text, and only on the user's own card", async () => {
    await updateItem(USER_ID, "item_1", { title: "Nuevo", description: "d" });

    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item_1", userId: USER_ID },
      data: { title: "Nuevo", description: "d" },
    });
  });

  it("says the card was not found when it is not the user's", async () => {
    boardItem.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateItem(USER_ID, "item_9", { title: "x", description: null }),
    ).rejects.toBeInstanceOf(BoardItemNotFoundError);
  });
});

describe("deleteItem", () => {
  it("deletes only the user's own card", async () => {
    await deleteItem(USER_ID, "item_1");

    expect(boardItem.deleteMany).toHaveBeenCalledWith({
      where: { id: "item_1", userId: USER_ID },
    });
  });

  it("says the card was not found when it is not the user's", async () => {
    boardItem.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteItem(USER_ID, "item_9")).rejects.toBeInstanceOf(
      BoardItemNotFoundError,
    );
  });
});

describe("moveItem", () => {
  it("looks the card up among the user's own before touching anything", async () => {
    await moveItem(USER_ID, { id: "x", status: "DONE", index: 0 });

    expect(boardItem.findFirst).toHaveBeenCalledWith({
      where: { id: "x", userId: USER_ID },
      select: { id: true },
    });
  });

  it("says the card was not found, and writes nothing, when it is not the user's", async () => {
    boardItem.findFirst.mockResolvedValue(null);

    await expect(
      moveItem(USER_ID, { id: "x", status: "DONE", index: 0 }),
    ).rejects.toBeInstanceOf(BoardItemNotFoundError);
    expect(boardItem.updateMany).not.toHaveBeenCalled();
  });

  it("reads the target column without the moving card", async () => {
    await moveItem(USER_ID, { id: "x", status: "DONE", index: 0 });

    expect(boardItem.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "DONE", id: { not: "x" } },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, position: true },
    });
  });

  it("drops into an empty column at the first step", async () => {
    await moveItem(USER_ID, { id: "x", status: "DONE", index: 0 });

    expect(boardItem.updateMany).toHaveBeenCalledTimes(1);
    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "x", userId: USER_ID },
      data: { status: "DONE", position: 1024 },
    });
  });

  it("takes the midpoint between the neighbours at the index, writing only the moving card", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 1024),
      sibling("b", 2048),
      sibling("c", 3072),
    ]);

    await moveItem(USER_ID, { id: "x", status: "DONE", index: 2 });

    expect(boardItem.updateMany).toHaveBeenCalledTimes(1);
    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "x", userId: USER_ID },
      data: { status: "DONE", position: 2560 },
    });
  });

  it("goes to the end of the column with an index past it", async () => {
    boardItem.findMany.mockResolvedValue([sibling("a", 1024)]);

    await moveItem(USER_ID, { id: "x", status: "DONE", index: 99 });

    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "x", userId: USER_ID },
      data: { status: "DONE", position: 2048 },
    });
  });

  it("goes before the first card at index 0", async () => {
    boardItem.findMany.mockResolvedValue([sibling("a", 1024)]);

    await moveItem(USER_ID, { id: "x", status: "TODO", index: 0 });

    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "x", userId: USER_ID },
      data: { status: "TODO", position: 0 },
    });
  });

  it("numbers the column again, in the same transaction, when the gap has collapsed", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 10),
      sibling("b", 10 + 1e-12),
    ]);

    await moveItem(USER_ID, { id: "x", status: "TODO", index: 1 });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "a", userId: USER_ID },
      data: { position: 1024 },
    });
    expect(boardItem.updateMany).toHaveBeenCalledWith({
      where: { id: "b", userId: USER_ID },
      data: { position: 2048 },
    });
    expect(boardItem.updateMany).toHaveBeenLastCalledWith({
      where: { id: "x", userId: USER_ID },
      data: { status: "TODO", position: 1536 },
    });
  });

  it("only rewrites the cards whose position really changes when it numbers a column again", async () => {
    boardItem.findMany.mockResolvedValue([
      sibling("a", 1024),
      sibling("b", 2048 - 1e-12),
      sibling("c", 2048),
    ]);

    await moveItem(USER_ID, { id: "x", status: "TODO", index: 2 });

    const rewritten = boardItem.updateMany.mock.calls
      .map(([call]) => call.where.id)
      .filter((id: string) => id !== "x");

    expect(rewritten).toEqual(["b", "c"]);
  });
});
