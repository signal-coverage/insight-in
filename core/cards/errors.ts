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

// A card never changes kind: a credit card may have plans hanging from it.
export class CardKindLockedError extends Error {
  constructor() {
    super("The kind of a card cannot change");
    this.name = "CardKindLockedError";
  }
}

// A card never moves to another bank.
export class CardBankLockedError extends Error {
  constructor() {
    super("The bank of a card cannot change");
    this.name = "CardBankLockedError";
  }
}

// Only a credit card can pay this (a purchase in installments).
export class CardKindNotAllowedError extends Error {
  constructor() {
    super("Only a credit card can be used here");
    this.name = "CardKindNotAllowedError";
  }
}

// The bank of a debit card has no active account in the currency of the expense (or the one it had was
// archived or changed while the expense was being saved).
export class CardBankWithoutAccountError extends Error {
  constructor(readonly currency: string) {
    super(`The bank of the card has no active account in ${currency}`);
    this.name = "CardBankWithoutAccountError";
  }
}
