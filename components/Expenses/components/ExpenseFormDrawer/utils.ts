import { firstInstallmentDate, statementClosingDate } from "@/core/cards/cycle";
import { debitAccountIn } from "@/core/cards/kinds";
import { formatIncomeDate } from "@/core/incomes/dates";

import type { CardOption, DebitCardOption, ExpenseRow } from "../../types";
import { chargeLine } from "./consts";

// The line under the purchase date: when the card charges it and which statement closes before that.
// Null while there is no card or no date to work it out from.
export const chargeLineFor = (
  card: CardOption | undefined,
  purchaseDate: string | null,
): string | null => {
  // Only a credit card has a cycle; a debit card takes the money the same day.
  if (!card || card.kind !== "CREDIT" || !purchaseDate) {
    return null;
  }

  return chargeLine(
    formatIncomeDate(
      firstInstallmentDate(purchaseDate, card.closingDay, card.dueDay),
    ),
    formatIncomeDate(statementClosingDate(purchaseDate, card.closingDay)),
  );
};

// Whether the expense being edited already has this card in this currency: then it keeps the card
// (and, for a debit card, the account its money left) even if the card no longer pays in it.
export const keepsOwnCard = (
  expense: Pick<ExpenseRow, "cardId" | "currency"> | null,
  cardId: string,
  currency: string,
): boolean =>
  expense !== null &&
  expense.cardId === cardId &&
  expense.currency === currency;

// The account a debit card's expense takes its money from, as the server will resolve it: the one the
// edited expense already left when it keeps the card and the currency, otherwise the bank's account in
// the currency.
export const debitAccountLabel = (
  card: DebitCardOption,
  currency: string,
  expense: Pick<ExpenseRow, "cardId" | "currency" | "accountLabel"> | null,
): string =>
  expense !== null && keepsOwnCard(expense, card.id, currency)
    ? expense.accountLabel
    : (debitAccountIn(card, currency)?.label ?? "");
