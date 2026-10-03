// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The expense an income was linked to does not exist or is not the user's.
export class ReimbursedExpenseNotFoundError extends Error {
  constructor() {
    super("Reimbursed expense not found");
    this.name = "ReimbursedExpenseNotFoundError";
  }
}

// The expense an income was linked to does not expect a reimbursement.
export class ReimbursementNotExpectedError extends Error {
  constructor() {
    super("The expense does not expect a reimbursement");
    this.name = "ReimbursementNotExpectedError";
  }
}

// An income was linked to an expense in another currency than its own.
export class ReimbursementCurrencyMismatchError extends Error {
  constructor() {
    super("The expense is in another currency");
    this.name = "ReimbursementCurrencyMismatchError";
  }
}

// An expense that has incomes linked to it cannot change its currency: they are all in the same one.
export class ExpenseCurrencyLockedError extends Error {
  constructor() {
    super("The expense has linked reimbursements");
    this.name = "ExpenseCurrencyLockedError";
  }
}

// An expense that has incomes linked to it cannot stop expecting a reimbursement.
export class ReimbursementLockedError extends Error {
  constructor() {
    super("The expense has linked reimbursements");
    this.name = "ReimbursementLockedError";
  }
}
