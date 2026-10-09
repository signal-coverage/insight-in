import { accountLabel } from "@/core/accounts/label";
import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";
import { isUniqueConstraintError } from "@/core/entries/dbErrors";
import { dateToIsoDate, todayIso } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthOf } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";
import type { Card as CardRow, Prisma } from "@/lib/generated/prisma/client";

import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import type {
  Card,
  CardCharge,
  CardInput,
  CardWithCharges,
  CardWithUsage,
  DebitAccount,
} from "./types";
import { usageOf } from "./usage";

// What every read of a card brings along: its caps by currency, the name of its bank, and the bank's
// active accounts (a debit card spends from them), oldest first and then by id, like the Banks board.
export const WITH_CARD_DETAILS = {
  limits: { orderBy: { currency: "asc" } },
  bank: {
    select: {
      name: true,
      accounts: {
        where: { archivedAt: null },
        select: { id: true, name: true, currency: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  },
} satisfies Prisma.CardInclude;

type CardRecord = Pick<
  CardRow,
  | "id"
  | "kind"
  | "bankId"
  | "last4"
  | "brand"
  | "closingDay"
  | "dueDay"
  | "limitMode"
> & {
  limits: { currency: string; amount: bigint }[];
  bank: {
    name: string;
    accounts: { id: string; name: string; currency: string }[];
  };
};

// One account per currency: the first of each in the order read (the oldest), as "Banco · Cuenta".
const firstPerCurrency = (
  bankName: string,
  accounts: CardRecord["bank"]["accounts"],
): DebitAccount[] => {
  const seen = new Set<string>();

  return accounts.flatMap((account) => {
    if (seen.has(account.currency)) {
      return [];
    }

    seen.add(account.currency);

    return [
      {
        id: account.id,
        currency: account.currency,
        label: accountLabel(bankName, account.name),
      },
    ];
  });
};

const toCard = (row: CardRecord): Card => {
  const identity = {
    id: row.id,
    bankId: row.bankId,
    bankName: row.bank.name,
    last4: row.last4,
    brand: row.brand,
  };

  if (row.kind === "DEBIT") {
    return {
      ...identity,
      kind: "DEBIT",
      accounts: firstPerCurrency(row.bank.name, row.bank.accounts),
    };
  }

  // A CHECK constraint of the table keeps the cycle and the mode of a credit card set.
  if (
    row.closingDay === null ||
    row.dueDay === null ||
    row.limitMode === null
  ) {
    throw new Error(`The credit card ${row.id} has no cycle`);
  }

  return {
    ...identity,
    kind: "CREDIT",
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    limitMode: row.limitMode,
    limits: row.limits.map(({ currency, amount }) => ({
      currency,
      amount: minorUnitsToNumber(amount),
    })),
  };
};

// Explicit field list: the owner, the id, the kind and the bank are never part of an update. A debit
// card writes nulls, which the table's CHECK constraint requires.
const toCardData = (input: CardInput) =>
  input.kind === "CREDIT"
    ? {
        last4: input.last4,
        brand: input.brand,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        limitMode: input.limitMode,
      }
    : {
        last4: input.last4,
        brand: input.brand,
        closingDay: null,
        dueDay: null,
        limitMode: null,
      };

const toLimitData = (input: CardInput) =>
  input.kind === "CREDIT"
    ? input.limits.map(({ currency, amount }) => ({
        currency,
        amount: BigInt(amount),
      }))
    : [];

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
      include: WITH_CARD_DETAILS,
    }),
    findChargesByCard(userId),
  ]);

  return rows.map((row) => ({
    ...toCard(row),
    charges: charges.get(row.id) ?? [],
  }));
};

// The user's cards with what each credit card has used of each of its caps in `month` (the current
// month in Argentina by default); a debit card has no cap, so no usage. Every read is scoped by
// userId, so one user can never see another user's cards.
export const listCards = async (
  userId: string,
  month: string = monthOf(todayIso()),
): Promise<CardWithUsage[]> => {
  const cards = await findCardsWithCharges(userId);

  return cards.map(({ charges, ...card }) => {
    if (card.kind === "DEBIT") {
      return { ...card, usage: [] };
    }

    return {
      ...card,
      usage: card.limits.map((limit) => ({
        ...limit,
        ...usageOf(
          {
            currency: limit.currency,
            limitMode: card.limitMode,
            limitAmount: limit.amount,
          },
          charges,
          month,
        ),
      })),
    };
  });
};

// The user's cards with the charges made with each, which is what the planner needs to project a
// purchase on every card and see whether it fits, and what the expense form needs to offer them.
export const listCardsWithCharges = (
  userId: string,
): Promise<CardWithCharges[]> => findCardsWithCharges(userId);

// A card id that comes from the client is never trusted: it must belong to the user. Returns the
// card: its cycle decides a credit charge's date, its bank's accounts a debit expense's account.
export const findOwnedCard = async (
  userId: string,
  cardId: string,
): Promise<Card> => {
  const found = await prisma.card.findFirst({
    where: { id: cardId, userId },
    include: WITH_CARD_DETAILS,
  });

  if (!found) {
    throw new CardNotFoundError();
  }

  return toCard(found);
};

// The bank of a new card must be the user's and active. (An archive in the same instant can still
// land; the card then keeps its bank, like every card of a bank archived later.)
const assertUsableBank = async (
  userId: string,
  bankId: string,
): Promise<void> => {
  const bank = await prisma.bank.findFirst({
    where: { id: bankId, userId },
    select: { archivedAt: true },
  });

  if (!bank) {
    throw new BankNotFoundError();
  }

  if (bank.archivedAt !== null) {
    throw new BankArchivedError();
  }
};

export const createCard = async (
  userId: string,
  input: CardInput,
): Promise<Card> => {
  await assertUsableBank(userId, input.bankId);

  try {
    const row = await prisma.card.create({
      data: {
        userId,
        kind: input.kind,
        bankId: input.bankId,
        ...toCardData(input),
        limits: { create: toLimitData(input) },
      },
      include: WITH_CARD_DETAILS,
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

// The kind and the bank never change (a credit card may have plans hanging from it); everything else
// does, and the caps are replaced as a whole, in the same transaction as the card.
export const updateCard = async (
  userId: string,
  id: string,
  input: CardInput,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.card.findFirst({
        where: { id, userId },
        select: { kind: true, bankId: true },
      });

      if (!current) {
        throw new CardNotFoundError();
      }

      if (current.kind !== input.kind) {
        throw new CardKindLockedError();
      }

      if (current.bankId !== input.bankId) {
        throw new CardBankLockedError();
      }

      const { count } = await tx.card.updateMany({
        where: { id, userId },
        data: toCardData(input),
      });

      if (count === 0) {
        throw new CardNotFoundError();
      }

      await tx.cardLimit.deleteMany({ where: { cardId: id } });

      const limits = toLimitData(input);

      if (limits.length > 0) {
        await tx.cardLimit.createMany({
          data: limits.map((limit) => ({ cardId: id, ...limit })),
        });
      }
    });
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

  // The rule is part of the delete statement, so an expense that became pending after the count above
  // cannot lose its card.
  const { count } = await prisma.card.deleteMany({
    where: { id, userId, expenses: { none: { status: "PLANNED" } } },
  });

  if (count === 0) {
    const nowPending = await prisma.expense.count({
      where: { userId, status: "PLANNED", cardId: id },
    });

    throw nowPending > 0
      ? new CardHasPendingExpensesError()
      : new CardNotFoundError();
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
