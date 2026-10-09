export const ACCOUNT_LABEL_SEPARATOR = " · ";

// How an account is named wherever it appears next to a movement: "Banco Galicia · Caja de ahorro".
export const accountLabel = (bankName: string, accountName: string): string =>
  `${bankName}${ACCOUNT_LABEL_SEPARATOR}${accountName}`;

// An account as an entry read brings it along (see WITH_ACCOUNT_LABEL).
export interface AccountWithBank {
  name: string;
  bank: { name: string };
}

export const labelOfAccount = (account: AccountWithBank): string =>
  accountLabel(account.bank.name, account.name);

// What every read of an entry includes to label its account.
export const WITH_ACCOUNT_LABEL = {
  account: { select: { name: true, bank: { select: { name: true } } } },
} as const;
