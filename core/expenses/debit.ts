import { CardBankWithoutAccountError } from "@/core/cards/errors";
import { debitAccountIn } from "@/core/cards/kinds";
import type { DebitCard } from "@/core/cards/types";
import type { EntryStatus } from "@/core/entries/status";

// Pure rules of an expense paid with a debit or prepaid card, apart from the service so they are
// tested without a database.

// What a stored expense already has, as far as its card and its money are concerned.
export interface StoredCharge {
  cardId: string | null;
  currency: string;
  accountId: string;
  // Minor units.
  amount: number;
  // "YYYY-MM-DD".
  date: string;
  status: EntryStatus;
}

// What an expense asks of the account it takes money from.
export type DebitClaim = Pick<
  StoredCharge,
  "accountId" | "amount" | "date" | "status"
>;

// The account a debit card's expense takes its money from. An edit that keeps the card and the
// currency keeps the account the money already left (even if it was archived since, or the bank has
// another one now), so an edit of the notes can never fail on it. Otherwise it is the bank's active
// account in the expense's currency, and a bank without one refuses the expense.
export const debitAccountOf = (
  card: Pick<DebitCard, "id" | "accounts">,
  currency: string,
  stored: Pick<StoredCharge, "cardId" | "currency" | "accountId"> | null,
): string => {
  if (stored && stored.cardId === card.id && stored.currency === currency) {
    return stored.accountId;
  }

  const account = debitAccountIn(card, currency);

  if (!account) {
    throw new CardBankWithoutAccountError(currency);
  }

  return account.id;
};

// Only a paid expense moves money, so only a paid one is checked. An edit is checked again only when it
// asks something new of the account: it becomes paid, or takes from another account, on another day,
// or more money. The same money on the same account and day (an edit of the notes), or less of it,
// keeps the claim the account already honoured.
export const needsDebitFundsCheck = (
  stored: DebitClaim | null,
  next: DebitClaim,
): boolean =>
  next.status === "SETTLED" &&
  (stored === null ||
    stored.status !== "SETTLED" ||
    stored.accountId !== next.accountId ||
    stored.date !== next.date ||
    next.amount > stored.amount);
