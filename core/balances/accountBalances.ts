import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange } from "@/core/summary/month";
import type { Prisma } from "@/lib/generated/prisma/client";

import { sumAccountBalances } from "./accounts";
import { getOpeningBalances } from "./service";
import type { AccountBalance, AccountFlow } from "./types";

export type BalanceReader = Pick<
  Prisma.TransactionClient,
  "openingBalance" | "income" | "expense" | "transfer" | "account"
>;

export interface BalanceOptions {
  // Count only what had moved by this day ("YYYY-MM-DD", the day included): the balance of an account
  // on a date. Without it every settled movement counts, whatever its date (what the account holds now).
  asOf?: string;
  // A transfer left out of the sums: the one an edit is about to replace, so it never counts against
  // its own funds.
  excludeTransferId?: string;
  // An expense left out of the sums: the one an edit (or a change of status) is about to replace, so
  // it never counts against its own funds.
  excludeExpenseId?: string;
}

interface FlowGroup {
  accountId: string;
  currency: string;
  _sum: { amount: bigint | null };
}

interface TransferGroup {
  accountId: string;
  _sum: { amount: bigint | null };
}

const toFlows = (
  groups: readonly FlowGroup[],
  kind: AccountFlow["kind"],
): AccountFlow[] =>
  groups.flatMap(({ accountId, currency, _sum }) =>
    _sum.amount === null
      ? []
      : [
          {
            accountId,
            currency,
            kind,
            amount: minorUnitsToNumber(_sum.amount),
          },
        ],
  );

// A transfer has no currency of its own: it is the one of its accounts.
const toTransferFlows = (
  groups: readonly TransferGroup[],
  kind: "transferOut" | "transferIn",
  currencyOf: ReadonlyMap<string, string>,
): AccountFlow[] =>
  groups.flatMap(({ accountId, _sum }) => {
    const currency = currencyOf.get(accountId);

    return _sum.amount === null || currency === undefined
      ? []
      : [
          {
            accountId,
            currency,
            kind,
            amount: minorUnitsToNumber(_sum.amount),
          },
        ];
  });

const dateRange = (from: string | null, asOf: string | undefined) =>
  from === null && asOf === undefined
    ? {}
    : {
        date: {
          ...(from === null ? {} : { gte: isoDateToDate(from) }),
          ...(asOf === undefined ? {} : { lte: isoDateToDate(asOf) }),
        },
      };

// What the user's accounts hold (all of them, or only `accountIds`): the opening amount plus every
// settled income and transfer in, minus every settled expense and transfer out, counting from the
// first day of the opening month when there is one. A settled movement is money that already moved,
// so there is no upper date unless `asOf` asks for the balance of a day: then only what had moved by
// that day counts, and before the opening month began nothing does (no balance is invented). Scoped
// by userId. Any client can read it, so the archive rule and the transfers' funds check call it inside
// the transaction that locks the accounts. Accounts with neither an opening amount nor a movement are
// absent: their balance is 0.
export const readAccountBalances = async (
  db: BalanceReader,
  userId: string,
  accountIds?: readonly string[],
  { asOf, excludeTransferId, excludeExpenseId }: BalanceOptions = {},
): Promise<AccountBalance[]> => {
  const opening = await getOpeningBalances(userId, db);
  const openingFrom = opening ? monthRange(opening.month).from : null;

  if (openingFrom !== null && asOf !== undefined && asOf < openingFrom) {
    return [];
  }

  const range = dateRange(openingFrom, asOf);
  const scope = accountIds ? { in: [...accountIds] } : null;
  const query = {
    by: ["accountId", "currency"] as ("accountId" | "currency")[],
    where: {
      userId,
      status: "SETTLED" as const,
      ...(scope ? { accountId: scope } : {}),
      ...range,
    },
    _sum: { amount: true as const },
  };
  const incomes = await db.income.groupBy(query);
  const expenses = await db.expense.groupBy({
    ...query,
    where: {
      ...query.where,
      ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
    },
  });

  const transferWhere = {
    userId,
    ...range,
    ...(excludeTransferId ? { id: { not: excludeTransferId } } : {}),
  };
  const outgoing = (
    await db.transfer.groupBy({
      by: ["fromAccountId"],
      where: { ...transferWhere, ...(scope ? { fromAccountId: scope } : {}) },
      _sum: { amount: true },
    })
  ).map(({ fromAccountId, _sum }) => ({ accountId: fromAccountId, _sum }));
  const incoming = (
    await db.transfer.groupBy({
      by: ["toAccountId"],
      where: { ...transferWhere, ...(scope ? { toAccountId: scope } : {}) },
      _sum: { amount: true },
    })
  ).map(({ toAccountId, _sum }) => ({ accountId: toAccountId, _sum }));

  const transferAccountIds = [
    ...new Set([...outgoing, ...incoming].map(({ accountId }) => accountId)),
  ];
  const currencies =
    transferAccountIds.length === 0
      ? []
      : await db.account.findMany({
          where: { userId, id: { in: transferAccountIds } },
          select: { id: true, currency: true },
        });
  const currencyOf = new Map(
    currencies.map(({ id, currency }) => [id, currency]),
  );

  const wanted = accountIds ? new Set(accountIds) : null;
  const amounts = (opening?.amounts ?? []).filter(
    ({ accountId }) => wanted === null || wanted.has(accountId),
  );

  return sumAccountBalances(amounts, [
    ...toFlows(incomes, "income"),
    ...toFlows(expenses, "expense"),
    ...toTransferFlows(outgoing, "transferOut", currencyOf),
    ...toTransferFlows(incoming, "transferIn", currencyOf),
  ]);
};
