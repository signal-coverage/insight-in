// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The template does not exist or is not the user's.
export class RecurringNotFoundError extends Error {
  constructor() {
    super("Recurring expense not found");
    this.name = "RecurringNotFoundError";
  }
}

// The month's expense of a template cannot be taken out by disabling the template: it is already
// paid (or covered by someone else), so its money counts in the budget.
export class RecurringExpenseSettledError extends Error {
  constructor(
    readonly description: string,
    readonly status: "SETTLED" | "COVERED",
  ) {
    super(`The month's expense of "${description}" is already ${status}`);
    this.name = "RecurringExpenseSettledError";
  }
}

// The amount typed for one month does not parse in the currency of the template.
export class InvalidRecurringAmountError extends Error {
  constructor(readonly description: string) {
    super(`Invalid amount for the recurring expense "${description}"`);
    this.name = "InvalidRecurringAmountError";
  }
}

// The account a debit card takes the money from holds less than the expense, on its date or now
// (`available` is the lower of the two, in minor units of `currency`).
export class ExpenseInsufficientFundsError extends Error {
  constructor(
    readonly available: number,
    readonly currency: string,
  ) {
    super(`The account holds ${available} (${currency})`);
    this.name = "ExpenseInsufficientFundsError";
  }
}

// An expense paid with a credit card still needs the account that pays the statement.
export class ExpenseAccountRequiredError extends Error {
  constructor() {
    super("The expense needs an account");
    this.name = "ExpenseAccountRequiredError";
  }
}

// The expense changed between the moment it was read (and checked) and the moment it was written, so
// what was checked may no longer hold: nothing is written and the caller tries again.
export class ExpenseChangedError extends Error {
  constructor() {
    super("The expense changed while it was being saved");
    this.name = "ExpenseChangedError";
  }
}

// A paid expense with a debit card dated after today: the money would leave an account on a day that
// has not come.
export class ExpenseFutureDebitError extends Error {
  constructor() {
    super("A paid debit expense cannot be dated in the future");
    this.name = "ExpenseFutureDebitError";
  }
}
