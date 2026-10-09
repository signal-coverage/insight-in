// Kept apart from the service so actions can branch on them (and tests can mock the service)
// without the classes disappearing with it.

// The account does not exist or is not the user's.
export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

// The bank already has an account with this name (ignoring case).
export class DuplicateAccountError extends Error {
  constructor() {
    super("An account with this name already exists in the bank");
    this.name = "DuplicateAccountError";
  }
}

// An archived account takes no new movements (an edit may keep the one a record already has).
export class AccountArchivedError extends Error {
  constructor() {
    super("The account is archived");
    this.name = "AccountArchivedError";
  }
}

// A movement is always in the currency of its account.
export class AccountCurrencyMismatchError extends Error {
  constructor() {
    super("The account is in another currency than the movement");
    this.name = "AccountCurrencyMismatchError";
  }
}

// An account's currency is fixed once anything points at it (its movements are in that currency).
export class AccountCurrencyLockedError extends Error {
  constructor() {
    super("The account currency cannot change: it has movements");
    this.name = "AccountCurrencyLockedError";
  }
}

// An account is archived only at zero balance (in minor units of its currency).
export class AccountHasBalanceError extends Error {
  constructor(
    readonly balance: number,
    readonly currency: string,
  ) {
    super(`The account still holds ${balance} (${currency})`);
    this.name = "AccountHasBalanceError";
  }
}

// An account is archived only when nothing is still to happen on it: no planned income or expense and
// no recurring template points at it (they would generate or move money into an archived account).
export class AccountInUseError extends Error {
  constructor(
    readonly pending: number,
    readonly templates: number,
  ) {
    super(
      `The account still has ${pending} pending entries and ${templates} templates`,
    );
    this.name = "AccountInUseError";
  }
}

// An account is deleted only when nothing points at it: with any history it is archived instead.
export class AccountHasMovementsError extends Error {
  constructor() {
    super("The account has movements");
    this.name = "AccountHasMovementsError";
  }
}

// An entity bank holds legal tender only: a crypto currency needs a virtual wallet.
export class CryptoCurrencyNotAllowedError extends Error {
  constructor(readonly currency: string) {
    super(`An entity bank cannot hold ${currency}`);
    this.name = "CryptoCurrencyNotAllowedError";
  }
}
