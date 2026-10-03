import { isUniqueConstraintError } from "@/core/entries/dbErrors";
import { dateToIsoDate, todayIso } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthOf } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";
import type { Card as CardRow } from "@/lib/generated/prisma/client";

import {
  CardHasPendingExpensesError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import type {
  Card,
  CardCharge,
  CardInput,
  CardWithCharges,
  CardWithUsage,
} from "./types";
import { usageOf } from "./usage";

const toCard = (row: CardRow): Card => ({
  id: row.id,
  last4: row.last4,
  brand: row.brand,
  closingDay: row.closingDay,
  dueDay: row.dueDay,
  currency: row.currency,
  limitMode: row.limitMode,
  limitAmount: minorUnitsToNumber(row.limitAmount),
});

// Explicit field list: the owner and id can never be overridden by the payload.
const toWritableData = (input: CardInput) => ({
  last4: input.last4,
  brand: input.brand,
  closingDay: input.closingDay,
  dueDay: input.dueDay,
  currency: input.currency,
  limitMode: input.limitMode,
  limitAmount: BigInt(input.limitAmount),
});

// The charges of every card of the user, one read for all the cards: every expense that has a card,
// installments and purchases in one payment alike. The ones somebody else covered are not read, they
// never weigh on a cap; the pure usage functions decide, by the card's mode, which of the PLANNED and
// SETTLED ones count.
const findChargesByCard = async (
  userId: string,
): Promise<Map<string, CardCharge[]>> => {
  const rows = await prisma.expense.findMany({
    where: {
      userId,
      cardId: { not: null },
      status: { in: ["PLANNED", "SETTLED"] },
    },
    select: {
      amount: true,
      date: true,
      currency: true,
      status: true,
      cardId: true,
    },
  });
  const byCard = new Map<string, CardCharge[]>();

  for (const row of rows) {
    if (!row.cardId) {
      continue;
    }

    byCard.set(row.cardId, [
      ...(byCard.get(row.cardId) ?? []),
      {
        amount: minorUnitsToNumber(row.amount),
        date: dateToIsoDate(row.date),
        currency: row.currency,
        status: row.status,
      },
    ]);
  }

  return byCard;
};

const findCardsWithCharges = async (
  userId: string,
): Promise<CardWithCharges[]> => {
  const [rows, charges] = await Promise.all([
    prisma.card.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    findChargesByCard(userId),
  ]);

  return rows.map((row) => ({
    ...toCard(row),
    charges: charges.get(row.id) ?? [],
  }));
};

// The user's cards with what each has used of its cap in `month` (the current month in Argentina by
// default). Every read is scoped by userId, so one user can never see another user's cards.
export const listCards = async (
  userId: string,
  month: string = monthOf(todayIso()),
): Promise<CardWithUsage[]> => {
  const cards = await findCardsWithCharges(userId);

  return cards.map(({ charges, ...card }) => ({
    ...card,
    ...usageOf(card, charges, month),
  }));
};

// The user's cards with the charges made with each, which is what the planner needs to project a
// purchase on every card and see whether it fits.
export const listCardsWithCharges = (
  userId: string,
): Promise<CardWithCharges[]> => findCardsWithCharges(userId);

// A card id that comes from the client is never trusted: it must belong to the user. Returns the
// card, since its billing cycle decides the charge date.
export const findOwnedCard = async (
  userId: string,
  cardId: string,
): Promise<Card> => {
  const found = await prisma.card.findFirst({ where: { id: cardId, userId } });

  if (!found) {
    throw new CardNotFoundError();
  }

  return toCard(found);
};

export const createCard = async (
  userId: string,
  input: CardInput,
): Promise<Card> => {
  try {
    const row = await prisma.card.create({
      data: { userId, ...toWritableData(input) },
    });

    return toCard(row);
  } catch (error) {
    // A user has one card per brand and last four digits; the constraint is what decides.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCardError(input.brand, input.last4);
    }

    throw error;
  }
};

export const updateCard = async (
  userId: string,
  id: string,
  input: CardInput,
): Promise<void> => {
  try {
    const { count } = await prisma.card.updateMany({
      where: { id, userId },
      data: toWritableData(input),
    });

    if (count === 0) {
      throw new CardNotFoundError();
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateCardError(input.brand, input.last4);
    }

    throw error;
  }
};

// Blocked while any expense charged to the card (an installment or a purchase in one payment) is
// still pending: the cap of a card that is gone could not be checked against what is owed on it.
// Otherwise the card goes and its plans and expenses stay, with no card (the foreign key sets it to
// null).
export const deleteCard = async (userId: string, id: string): Promise<void> => {
  const found = await prisma.card.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!found) {
    throw new CardNotFoundError();
  }

  const pending = await prisma.expense.count({
    where: { userId, status: "PLANNED", cardId: id },
  });

  if (pending > 0) {
    throw new CardHasPendingExpensesError();
  }

  const { count } = await prisma.card.deleteMany({ where: { id, userId } });

  if (count === 0) {
    throw new CardNotFoundError();
  }
};

// Deletes the user's cards among `ids`, by the same rule as deleteCard: a card with an expense still
// pending is left out. The rule is part of the delete statement itself, so a charge added while it
// runs cannot slip past it. `skipped` is how many of the user's cards were left out; an id that is
// gone or is not the user's is neither deleted nor skipped.
export const deleteCards = async (
  userId: string,
  ids: readonly string[],
): Promise<{ deleted: number; skipped: number }> => {
  const owned = { id: { in: [...ids] }, userId };
  // Counted before the delete: afterwards the deleted ones would no longer be there to count.
  const found = await prisma.card.count({ where: owned });
  const { count } = await prisma.card.deleteMany({
    where: { ...owned, expenses: { none: { status: "PLANNED" } } },
  });

  return { deleted: count, skipped: Math.max(0, found - count) };
};
