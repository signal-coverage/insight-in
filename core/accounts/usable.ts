import { prisma } from "@/infrastructure/db/client";

import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "./errors";

// What a write wants to do with an account: put a movement of `currency` in it. `keepAccountId` is
// the account the record already has (null or absent for a new one).
export interface AccountUse {
  accountId: string;
  currency: string;
  keepAccountId?: string | null;
}

// The client only sends an account id, so it is never trusted: the account must be the user's (any
// other id behaves as not found), in the currency of the movement and active. An edit may keep the
// account the record already has even if it was archived since, so old entries stay editable; it can
// never move a record to an archived account. The check is not serialized against a concurrent
// archive or currency change of the account (stage 2b locks those writes, not the entry writes): the
// window is a single request wide.
export const assertUsableAccount = async (
  userId: string,
  { accountId, currency, keepAccountId = null }: AccountUse,
): Promise<void> => {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true, currency: true, archivedAt: true },
  });

  if (!account) {
    throw new AccountNotFoundError();
  }

  if (account.currency !== currency) {
    throw new AccountCurrencyMismatchError();
  }

  if (account.archivedAt !== null && account.id !== keepAccountId) {
    throw new AccountArchivedError();
  }
};
