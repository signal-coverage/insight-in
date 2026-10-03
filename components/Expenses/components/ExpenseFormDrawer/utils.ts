import { firstInstallmentDate, statementClosingDate } from "@/core/cards/cycle";
import { formatIncomeDate } from "@/core/incomes/dates";

import type { CardOption } from "../../types";
import { chargeLine } from "./consts";

// The line under the purchase date: when the card charges it and which statement closes before that.
// Null while there is no card or no date to work it out from.
export const chargeLineFor = (
  card: CardOption | undefined,
  purchaseDate: string | null,
): string | null => {
  if (!card || !purchaseDate) {
    return null;
  }

  return chargeLine(
    formatIncomeDate(
      firstInstallmentDate(purchaseDate, card.closingDay, card.dueDay),
    ),
    formatIncomeDate(statementClosingDate(purchaseDate, card.closingDay)),
  );
};
