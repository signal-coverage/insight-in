// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The bank does not exist or is not the user's.
export class BankNotFoundError extends Error {
  constructor() {
    super("Bank not found");
    this.name = "BankNotFoundError";
  }
}

// The user already has a bank with this name (ignoring case).
export class DuplicateBankError extends Error {
  constructor() {
    super("A bank with this name already exists");
    this.name = "DuplicateBankError";
  }
}

// A bank is archived only when all its accounts are.
export class BankHasActiveAccountsError extends Error {
  constructor(readonly count: number) {
    super(`The bank still has ${count} active account(s)`);
    this.name = "BankHasActiveAccountsError";
  }
}

// An account cannot be created in, or brought back under, an archived bank.
export class BankArchivedError extends Error {
  constructor() {
    super("The bank is archived");
    this.name = "BankArchivedError";
  }
}

// A bank is deleted only when it has no accounts left (archived ones count as left).
export class BankHasAccountsError extends Error {
  constructor(readonly count: number) {
    super(`The bank still has ${count} account(s)`);
    this.name = "BankHasAccountsError";
  }
}

// A bank is deleted only when no card belongs to it.
export class BankHasCardsError extends Error {
  constructor(readonly count: number) {
    super(`The bank still has ${count} card(s)`);
    this.name = "BankHasCardsError";
  }
}

// A bank becomes an entity only when none of its accounts (archived ones included) is in a crypto
// currency.
export class BankHasCryptoAccountsError extends Error {
  constructor(readonly count: number) {
    super(`The bank still has ${count} crypto account(s)`);
    this.name = "BankHasCryptoAccountsError";
  }
}
