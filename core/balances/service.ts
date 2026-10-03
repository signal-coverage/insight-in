import { listExpenseCurrencies } from "@/core/expenses/service";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { listIncomeCurrencies } from "@/core/incomes/service";
import { prisma } from "@/infrastructure/db/client";

import type { OpeningBalanceInput } from "./schema";
import type { OpeningBalanceEditorData, OpeningBalances } from "./types";

// The user's opening balance, or null when they never set one (the previous balance then
// accumulates from their first entry). Every row shares the one month.
export const getOpeningBalances = async (
  userId: string,
): Promise<OpeningBalances | null> => {
  const rows = await prisma.openingBalance.findMany({ where: { userId } });

  if (rows.length === 0) {
    return null;
  }

  return {
    month: rows[0].month,
    amounts: rows.map((row) => ({
      currency: row.currency,
      medium: row.medium,
      amount: minorUnitsToNumber(row.amount),
    })),
  };
};

// Replaces the user's opening balance with the amounts given, all valid from the same month:
// each amount is written (created or updated), and any other row the user had is removed, so
// whatever was cleared stops counting. No amount at all removes the opening balance. It all
// happens in one transaction, so the rows never end up with different months.
export const saveOpeningBalances = async (
  userId: string,
  { month, amounts }: OpeningBalanceInput,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.openingBalance.deleteMany({
      where:
        amounts.length === 0
          ? { userId }
          : {
              userId,
              NOT: amounts.map(({ currency, medium }) => ({
                currency,
                medium,
              })),
            },
    });

    for (const { currency, medium, amount } of amounts) {
      await tx.openingBalance.upsert({
        where: { userId_currency_medium: { userId, currency, medium } },
        create: { userId, currency, medium, amount: BigInt(amount), month },
        update: { amount: BigInt(amount), month },
      });
    }
  });
};

// Everything the opening balance editor needs: what is saved, and the currencies it offers
// a row for: the ones the user has entries in, the ones already in the opening balance, and
// the default one, which comes first.
export const getOpeningBalanceEditorData = async (
  userId: string,
): Promise<OpeningBalanceEditorData> => {
  const [opening, incomeCurrencies, expenseCurrencies] = await Promise.all([
    getOpeningBalances(userId),
    listIncomeCurrencies(userId),
    listExpenseCurrencies(userId),
  ]);
  const others = new Set([
    ...incomeCurrencies,
    ...expenseCurrencies,
    ...(opening?.amounts.map((amount) => amount.currency) ?? []),
  ]);

  others.delete(DEFAULT_CURRENCY_CODE);

  return {
    opening,
    currencies: [
      DEFAULT_CURRENCY_CODE,
      ...[...others].sort((a, b) => a.localeCompare(b)),
    ],
  };
};
