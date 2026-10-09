// Kept apart from the services so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// COVERED ("Cubierta por otro") was asked for an entry that is not an expense: nothing else ever
// pays an income, so it always moves the user's money.
export class CoveredNotAllowedError extends Error {
  constructor() {
    super("Only expenses can be covered by someone else");
    this.name = "CoveredNotAllowedError";
  }
}

// An installment (of a purchase or of a repayment) was edited into another currency: it keeps the
// currency of its plan.
export class InstallmentCurrencyLockedError extends Error {
  constructor() {
    super("An installment keeps the currency of its plan");
    this.name = "InstallmentCurrencyLockedError";
  }
}
