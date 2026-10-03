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
