// Test support: imported by tests only, never by production code.
import { creditCard, debitCard } from "@/core/cards/testFixtures";
import type { CreditCardPatch } from "@/core/cards/testFixtures";
import type { CardCharge, DebitCard } from "@/core/cards/types";

import type { CardOption, CreditCardOption } from "./types";

interface OptionExtras {
  title?: string;
  charges?: CardCharge[];
}

// Builders for the tests of the forms: a card as toCardOptions hands it to them.
export const creditOption = ({
  title = "Visa •••• 1234",
  charges = [],
  ...patch
}: CreditCardPatch & OptionExtras = {}): CreditCardOption => {
  const card = creditCard(patch);

  return {
    ...card,
    title,
    charges,
    currencies: card.limits.map(({ currency }) => currency),
  };
};

export const debitOption = ({
  title = "Visa •••• 9999",
  charges = [],
  ...patch
}: Partial<DebitCard> & OptionExtras = {}): CardOption => {
  const card = debitCard(patch);

  return {
    ...card,
    title,
    charges,
    currencies: card.accounts.map(({ currency }) => currency),
  };
};
