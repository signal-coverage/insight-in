export const ADD_ACCOUNT_TEXT = "+ Nueva cuenta";

// Says which bank it adds to, and contains the visible text.
export const addAccountLabel = (bankName: string): string =>
  `${ADD_ACCOUNT_TEXT} en ${bankName}`;
