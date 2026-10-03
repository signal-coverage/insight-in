import { todayIso } from "@/core/incomes/dates";
import { prisma } from "@/infrastructure/db/client";
import type { BoardItem as BoardItemRow } from "@/lib/generated/prisma/client";

import { groupByStatus } from "./board";
import { BoardItemNotFoundError } from "./errors";
import { needsRenumber, positionBetween, renumbered } from "./position";
import type {
  BoardColumns,
  BoardItem,
  BoardItemInput,
  BoardStatus,
  CreateItemInput,
  MoveItemInput,
} from "./types";

// What a transaction callback receives: the same model methods as the client.
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// The order every read of a column uses, so a tie between two positions is always broken the same way.
const COLUMN_ORDER = [{ position: "asc" as const }, { id: "asc" as const }];

// The row as the board shows it: no owner, and the creation moment as the calendar day it was in
// Argentina.
const toItem = (row: BoardItemRow): BoardItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  position: row.position,
  createdAt: todayIso(row.createdAt),
});

// The user's board: every column with its cards in order. The read is scoped by userId, so one user
// can never see another user's cards.
export const listBoard = async (userId: string): Promise<BoardColumns> => {
  const rows = await prisma.boardItem.findMany({
    where: { userId },
    orderBy: COLUMN_ORDER,
  });

  return groupByStatus(rows.map(toItem));
};

// The position a card takes at `index` of a column (counted among `siblings`, the cards that stay in
// it, in order). Between two neighbours it is their midpoint; when those are too close to tell
// apart, the column is numbered again first, inside the same transaction as the write that follows.
const positionAt = async (
  tx: Transaction,
  userId: string,
  siblings: readonly { id: string; position: number }[],
  index: number,
): Promise<number> => {
  const place = Math.min(Math.max(index, 0), siblings.length);
  const positions = siblings.map((sibling) => sibling.position);

  if (needsRenumber(positions[place - 1] ?? null, positions[place] ?? null)) {
    const fresh = renumbered(siblings.length);

    // Only the cards whose position really changes are written.
    for (const [at, sibling] of siblings.entries()) {
      if (fresh[at] !== sibling.position) {
        await tx.boardItem.updateMany({
          where: { id: sibling.id, userId },
          data: { position: fresh[at] },
        });
      }
    }

    return positionBetween(fresh[place - 1] ?? null, fresh[place] ?? null);
  }

  return positionBetween(
    positions[place - 1] ?? null,
    positions[place] ?? null,
  );
};

const readColumn = (
  tx: Transaction,
  userId: string,
  status: BoardStatus,
  excludingId?: string,
) =>
  tx.boardItem.findMany({
    where: {
      userId,
      status,
      ...(excludingId ? { id: { not: excludingId } } : {}),
    },
    orderBy: COLUMN_ORDER,
    select: { id: true, position: true },
  });

// Creates a card at the end of its column, or at `index` when one is given.
export const createItem = async (
  userId: string,
  { title, description, status, index }: CreateItemInput,
): Promise<BoardItem> =>
  prisma.$transaction(async (tx) => {
    const siblings = await readColumn(tx, userId, status);
    const position = await positionAt(
      tx,
      userId,
      siblings,
      index ?? siblings.length,
    );
    // Explicit field list: the owner and the id can never be overridden by the payload.
    const row = await tx.boardItem.create({
      data: { userId, title, description, status, position },
    });

    return toItem(row);
  });

// Changes the text of the user's card. Its column and its place stay as they are.
export const updateItem = async (
  userId: string,
  id: string,
  { title, description }: BoardItemInput,
): Promise<void> => {
  const { count } = await prisma.boardItem.updateMany({
    where: { id, userId },
    data: { title, description },
  });

  if (count === 0) {
    throw new BoardItemNotFoundError();
  }
};

// Moves the user's card to `index` of the column `status` (counted among the cards that stay in that
// column). Only the moving card is written, unless the column has to be numbered again, and that
// happens in the same transaction.
export const moveItem = async (
  userId: string,
  { id, status, index }: MoveItemInput,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const found = await tx.boardItem.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!found) {
      throw new BoardItemNotFoundError();
    }

    const siblings = await readColumn(tx, userId, status, id);
    const position = await positionAt(tx, userId, siblings, index);

    await tx.boardItem.updateMany({
      where: { id, userId },
      data: { status, position },
    });
  });
};

export const deleteItem = async (userId: string, id: string): Promise<void> => {
  const { count } = await prisma.boardItem.deleteMany({
    where: { id, userId },
  });

  if (count === 0) {
    throw new BoardItemNotFoundError();
  }
};
