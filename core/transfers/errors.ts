// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// Money cannot leave an account and enter the same one.
export class TransferSameAccountError extends Error {
  constructor() {
    super("The transfer has the same account on both sides");
    this.name = "TransferSameAccountError";
  }
}

// A transfer is money that already moved: its day is never after today (Argentine time).
export class TransferFutureDateError extends Error {
  constructor() {
    super("The transfer date is in the future");
    this.name = "TransferFutureDateError";
  }
}

// The source account held less than the amount on the transfer date (minor units, in `currency`).
export class TransferInsufficientFundsError extends Error {
  constructor(
    readonly available: number,
    readonly currency: string,
  ) {
    super(`The source account held ${available} (${currency}) on that date`);
    this.name = "TransferInsufficientFundsError";
  }
}

export type TransferSide = "from" | "to";

export type TransferAccountProblem =
  "NOT_FOUND" | "ARCHIVED" | "CURRENCY_MISMATCH";

// One side of the transfer has an account that cannot be used: not the user's, archived, or in
// another currency than the transfer. The side tells the form which field to mark.
export class TransferAccountError extends Error {
  constructor(
    readonly side: TransferSide,
    readonly problem: TransferAccountProblem,
  ) {
    super(`The ${side} account of the transfer is unusable: ${problem}`);
    this.name = "TransferAccountError";
  }
}

// Undoing a transfer (deleting it, lowering its amount, moving it to another destination) takes money
// back from an account, and this one already spent it. `available` is what it holds now and `amount`
// what it would have to give back (minor units, in `currency`); `accountLabel` is "Banco · Cuenta".
export class TransferGiveBackError extends Error {
  constructor(
    readonly accountLabel: string,
    readonly available: number,
    readonly amount: number,
    readonly currency: string,
  ) {
    super(
      `${accountLabel} holds ${available} (${currency}) and would have to give back ${amount}`,
    );
    this.name = "TransferGiveBackError";
  }
}
