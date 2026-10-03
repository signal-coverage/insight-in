// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.
import type { CardBrand } from "./types";

// The card does not exist or is not the user's.
export class CardNotFoundError extends Error {
  constructor() {
    super("Card not found");
    this.name = "CardNotFoundError";
  }
}

// The user already has a card of that brand ending in those digits.
export class DuplicateCardError extends Error {
  constructor(
    readonly brand: CardBrand,
    readonly last4: string,
  ) {
    super(`Duplicate card: ${brand} ending in ${last4}`);
    this.name = "DuplicateCardError";
  }
}

// A card cannot be deleted while an expense charged to it (an installment or a purchase in one
// payment) is still to pay.
export class CardHasPendingExpensesError extends Error {
  constructor() {
    super("The card has pending expenses");
    this.name = "CardHasPendingExpensesError";
  }
}

// An expense or plan was paired with a card of another currency than its own.
export class CardCurrencyMismatchError extends Error {
  constructor() {
    super("The card is in another currency");
    this.name = "CardCurrencyMismatchError";
  }
}
