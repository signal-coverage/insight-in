import { readAccountBalances } from "@/core/balances/accountBalances";
import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";
import { bankAcceptsCurrency } from "@/core/banks/kinds";
import { lockBank, lockBankOfAccount } from "@/core/banks/locks";
import {
  isForeignKeyError,
  isUniqueConstraintError,
} from "@/core/entries/dbErrors";
import { prisma } from "@/infrastructure/db/client";

import {
  AccountCurrencyLockedError,
  AccountHasBalanceError,
  AccountHasMovementsError,
  AccountInUseError,
  AccountNotFoundError,
  CryptoCurrencyNotAllowedError,
  DuplicateAccountError,
} from "./errors";
import { lockAccount } from "./locks";
import { toAccount } from "./mappers";
import { countAccountMovements } from "./movements";
import type { Account, AccountInput, CreateAccountInput } from "./types";

// Names are unique per bank, ignoring case: "Efectivo" may exist in two banks, never twice in one.
// The case-insensitive check is check-then-insert: the unique constraint only catches an
// identical-casing race. A bank id that comes from the client is never trusted: it must be the user's
// and it must be active. The bank row is locked for the whole write, and archiving the bank takes the
// same lock, so an account can never be created under a bank archived at the same moment. An entity bank
// takes legal tender only; a wallet also takes crypto.
export const createAccount = async (
  userId: string,
  input: CreateAccountInput,
): Promise<Account> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const bank = await lockBank(tx, userId, input.bankId);

      if (!bank) {
        throw new BankNotFoundError();
      }

      if (bank.archivedAt !== null) {
        throw new BankArchivedError();
      }

      // The kind is read under the same lock that archiving or retyping the bank takes.
      if (!bankAcceptsCurrency(bank.kind, input.currency)) {
        throw new CryptoCurrencyNotAllowedError(input.currency);
      }

      const duplicate = await tx.account.findFirst({
        where: {
          userId,
          bankId: bank.id,
          name: { equals: input.name, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new DuplicateAccountError();
      }

      // Explicit field list: the owner, the id and the archive date can never be overridden by the
      // payload.
      const row = await tx.account.create({
        data: {
          userId,
          bankId: bank.id,
          name: input.name,
          currency: input.currency,
        },
      });

      return toAccount(row);
    });
  } catch (error) {
    // Two requests with identical casing can both pass the check above; the constraint catches the
    // second (it is case-sensitive, so a case-only difference is not caught).
    if (isUniqueConstraintError(error)) {
      throw new DuplicateAccountError();
    }

    throw error;
  }
};

// Changes the name and the currency. The currency is fixed once the account has movements (entries,
// templates, plans or an opening amount): they are all in that currency. The account row is locked for
// the whole check and write, so a concurrent archive or currency change waits. Renaming to another
// casing of its own name is fine; clashing with another account of the same bank (ignoring case) is
// not. (A paid debit-card expense does lock its account; other entry writes do not, see archiveAccount.)
// The bank row is locked first (its kind decides whether a crypto currency is allowed), then the account row.
export const updateAccount = async (
  userId: string,
  id: string,
  input: AccountInput,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      // The bank first, then the account: no writer ever locks an account before a bank (archiving and
      // deleting an account take no bank lock at all), so a change of the bank's kind and a change of
      // this account's currency never interleave.
      const bank = await lockBankOfAccount(tx, userId, id);

      if (!bank) {
        throw new AccountNotFoundError();
      }

      const locked = await lockAccount(tx, userId, id);

      if (!locked) {
        throw new AccountNotFoundError();
      }

      const current = await tx.account.findFirst({
        where: { id, userId },
        select: { id: true, bankId: true },
      });

      if (!current) {
        throw new AccountNotFoundError();
      }

      if (input.currency !== locked.currency) {
        if ((await countAccountMovements(tx, userId, id)) > 0) {
          throw new AccountCurrencyLockedError();
        }

        if (!bankAcceptsCurrency(bank.kind, input.currency)) {
          throw new CryptoCurrencyNotAllowedError(input.currency);
        }
      }

      const duplicate = await tx.account.findFirst({
        where: {
          userId,
          bankId: current.bankId,
          id: { not: id },
          name: { equals: input.name, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new DuplicateAccountError();
      }

      await tx.account.updateMany({
        where: { id, userId },
        data: { name: input.name, currency: input.currency },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateAccountError();
    }

    throw error;
  }
};

// An account is archived only when it holds nothing and nothing is still to happen on it: its
// balance is zero, no planned income or expense is on it, and no recurring template points at it (a
// template would keep generating into it). Covered entries never move money, so they do not count. The
// account row is locked for the whole check and write. Archiving an archived account is not an error.
// (Only a paid debit-card expense locks its account; other entry writes do not, so a movement saved in the same instant as the archive can still
// land on it; the account's balance then shows it, in red if negative, and it can be reactivated.)
export const archiveAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const account = await lockAccount(tx, userId, id);

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.archivedAt !== null) {
      return;
    }

    const [current] = await readAccountBalances(tx, userId, [id]);
    const balance = current?.balance ?? 0;

    if (balance !== 0) {
      throw new AccountHasBalanceError(balance, account.currency);
    }

    const pendingIncomes = await tx.income.count({
      where: { userId, accountId: id, status: "PLANNED" },
    });
    const pendingExpenses = await tx.expense.count({
      where: { userId, accountId: id, status: "PLANNED" },
    });
    const incomeTemplates = await tx.recurringIncome.count({
      where: { userId, accountId: id },
    });
    const expenseTemplates = await tx.recurringExpense.count({
      where: { userId, accountId: id },
    });
    const pending = pendingIncomes + pendingExpenses;
    const templates = incomeTemplates + expenseTemplates;

    if (pending + templates > 0) {
      throw new AccountInUseError(pending, templates);
    }

    await tx.account.updateMany({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
  });
};

// An account is deleted only when nothing at all points at it (no income, expense, template, plan,
// transfer or opening amount): with any history it is archived instead. The account row is locked for
// the whole check and write. The foreign keys are Restrict, so a movement saved in the same instant
// (entry writes do not lock the account) makes the delete itself fail instead of being lost to a
// cascade; that refusal is the same error as the check.
export const deleteAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const account = await lockAccount(tx, userId, id);

      if (!account) {
        throw new AccountNotFoundError();
      }

      if ((await countAccountMovements(tx, userId, id)) > 0) {
        throw new AccountHasMovementsError();
      }

      const { count } = await tx.account.deleteMany({ where: { id, userId } });

      if (count === 0) {
        throw new AccountNotFoundError();
      }
    });
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new AccountHasMovementsError();
    }

    throw error;
  }
};

// An account is brought back only under an active bank. The bank row is locked first, and archiving
// the bank takes the same lock, so the two never interleave. Reactivating an active account is not an
// error (even under an archived bank: nothing changes).
export const unarchiveAccount = async (
  userId: string,
  id: string,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const bank = await lockBankOfAccount(tx, userId, id);

    if (!bank) {
      throw new AccountNotFoundError();
    }

    const account = await tx.account.findFirst({
      where: { id, userId },
      select: { archivedAt: true },
    });

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.archivedAt === null) {
      return;
    }

    if (bank.archivedAt !== null) {
      throw new BankArchivedError();
    }

    await tx.account.updateMany({
      where: { id, userId },
      data: { archivedAt: null },
    });
  });
};
