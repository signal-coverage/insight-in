// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The wizard asked for more installments in a month than the plan has pending (or for a count
// that is not a whole number).
export class InvalidInstallmentCountError extends Error {
  constructor(readonly description: string) {
    super(`Invalid installment count for the plan "${description}"`);
    this.name = "InvalidInstallmentCountError";
  }
}

// The plan to delete does not exist or is not the user's.
export class InstallmentPlanNotFoundError extends Error {
  constructor() {
    super("Installment plan not found");
    this.name = "InstallmentPlanNotFoundError";
  }
}

// The last installment of a purchase paid with a card would fall in a month the app cannot show (the
// card's cycle moved the first one past the supported years).
export class InstallmentOutOfRangeError extends Error {
  constructor() {
    super("The last installment falls outside the supported years");
    this.name = "InstallmentOutOfRangeError";
  }
}
