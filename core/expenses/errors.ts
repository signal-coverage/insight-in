// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The amount typed for one month does not parse in the currency of the template.
export class InvalidRecurringAmountError extends Error {
  constructor(readonly description: string) {
    super(`Invalid amount for the recurring expense "${description}"`);
    this.name = "InvalidRecurringAmountError";
  }
}
