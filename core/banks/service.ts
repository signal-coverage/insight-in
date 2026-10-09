import { toAccount } from "@/core/accounts/mappers";
import { CRYPTO_CURRENCY_CODES } from "@/core/currencies/consts";
import {
  isForeignKeyError,
  isUniqueConstraintError,
} from "@/core/entries/dbErrors";
import { prisma } from "@/infrastructure/db/client";
import type { Bank as BankRow } from "@/lib/generated/prisma/client";

import {
  BankHasAccountsError,
  BankHasActiveAccountsError,
  BankHasCardsError,
  BankHasCryptoAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import { lockBank } from "./locks";
import type { Bank, BankInput, BankWithAccounts } from "./types";

// The order every read uses, so a tie between two rows is always broken the same way.
const CREATION_ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];

const toBank = (row: BankRow): Bank => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  archived: row.archivedAt !== null,
});

// The user's banks with their accounts, archived ones included (the board decides what to show).
// Every read is scoped by userId, so one user can never see another user's banks.
export const listBanksWithAccounts = async (
  userId: string,
): Promise<BankWithAccounts[]> => {
  const rows = await prisma.bank.findMany({
    where: { userId },
    orderBy: CREATION_ORDER,
    include: { accounts: { where: { userId }, orderBy: CREATION_ORDER } },
  });

  return rows.map((row) => ({
    ...toBank(row),
    accounts: row.accounts.map(toAccount),
  }));
};

// Names are unique per user, ignoring case ("galicia" clashes with "Galicia"). The constraint is
// case-sensitive, so the lookup does the case-insensitive part (check-then-insert, not atomic).
export const createBank = async (
  userId: string,
  input: BankInput,
): Promise<Bank> => {
  const duplicate = await prisma.bank.findFirst({
    where: { userId, name: { equals: input.name, mode: "insensitive" } },
    select: { id: true },
  });

  if (duplicate) {
    throw new DuplicateBankError();
  }

  try {
    // Explicit field list: the owner and the id can never be overridden by the payload.
    const row = await prisma.bank.create({
      data: { userId, name: input.name, kind: input.kind },
    });

    return toBank(row);
  } catch (error) {
    // Two requests with identical casing can both pass the check above; the constraint catches the
    // second. Two that differ only in case can both succeed.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBankError();
    }

    throw error;
  }
};

// Renaming to another casing of its own name is fine; clashing with a different bank (ignoring case)
// is not. An entity never holds crypto: becoming one (or staying one) is refused while any account of
// the bank, archived ones included, is in a crypto currency; becoming a wallet is always fine. The bank
// row is locked for the whole check and write, and creating an account in it or changing the currency
// of one of its accounts takes the same lock, so no crypto account can slip in between the count and
// the write.
export const updateBank = async (
  userId: string,
  id: string,
  input: BankInput,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const locked = await lockBank(tx, userId, id);

      if (!locked) {
        throw new BankNotFoundError();
      }

      const duplicate = await tx.bank.findFirst({
        where: {
          userId,
          id: { not: id },
          name: { equals: input.name, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new DuplicateBankError();
      }

      if (input.kind === "ENTITY") {
        const cryptoAccounts = await tx.account.count({
          where: {
            userId,
            bankId: id,
            currency: { in: [...CRYPTO_CURRENCY_CODES] },
          },
        });

        if (cryptoAccounts > 0) {
          throw new BankHasCryptoAccountsError(cryptoAccounts);
        }
      }

      const { count } = await tx.bank.updateMany({
        where: { id, userId },
        data: { name: input.name, kind: input.kind },
      });

      if (count === 0) {
        throw new BankNotFoundError();
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateBankError();
    }

    throw error;
  }
};

// A bank is archived only when all its accounts are. The bank row is locked first, and creating or
// reactivating one of its accounts takes the same lock, so neither can slip in between the count and
// the archive. Archiving an archived bank is not an error.
export const archiveBank = async (
  userId: string,
  id: string,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const bank = await lockBank(tx, userId, id);

    if (!bank) {
      throw new BankNotFoundError();
    }

    if (bank.archivedAt !== null) {
      return;
    }

    const active = await tx.account.count({
      where: { bankId: id, userId, archivedAt: null },
    });

    if (active > 0) {
      throw new BankHasActiveAccountsError(active);
    }

    await tx.bank.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
  });
};

// Brings the bank back. Its accounts stay archived: the user reactivates the ones they want.
export const unarchiveBank = async (
  userId: string,
  id: string,
): Promise<void> => {
  const { count } = await prisma.bank.updateMany({
    where: { id, userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });

  if (count > 0) {
    return;
  }

  const found = await prisma.bank.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!found) {
    throw new BankNotFoundError();
  }
};

// Which of the two blockers a foreign-key refusal came from, read after the failed transaction.
const refusalOfBlockers = async (
  userId: string,
  id: string,
): Promise<Error | null> => {
  const accounts = await prisma.account.count({
    where: { bankId: id, userId },
  });

  if (accounts > 0) {
    return new BankHasAccountsError(accounts);
  }

  const cards = await prisma.card.count({ where: { bankId: id, userId } });

  return cards > 0 ? new BankHasCardsError(cards) : null;
};

// A bank is deleted only when nothing belongs to it: no account (archived ones count as left) and no
// card. The bank row is locked for the whole check and write, and creating an account in the bank takes
// the same lock. Creating a card does not, but the foreign keys are Restrict: a card saved in the same
// instant makes the delete itself fail instead of being lost, and that refusal becomes the same typed
// error as the check.
export const deleteBank = async (userId: string, id: string): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const bank = await lockBank(tx, userId, id);

      if (!bank) {
        throw new BankNotFoundError();
      }

      const accounts = await tx.account.count({
        where: { bankId: id, userId },
      });

      if (accounts > 0) {
        throw new BankHasAccountsError(accounts);
      }

      const cards = await tx.card.count({ where: { bankId: id, userId } });

      if (cards > 0) {
        throw new BankHasCardsError(cards);
      }

      const { count } = await tx.bank.deleteMany({ where: { id, userId } });

      if (count === 0) {
        throw new BankNotFoundError();
      }
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw (await refusalOfBlockers(userId, id)) ?? error;
    }

    throw error;
  }
};
