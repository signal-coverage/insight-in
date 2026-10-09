import { compareCurrencyCodes } from "@/core/currencies/crypto";

import type { AccountBalanceRow } from "./byAccount";

export interface BankAccounts {
  bankId: string;
  bankName: string;
  accounts: AccountBalanceRow[];
}

// One currency's accounts, grouped by bank, with their total. Currencies are never added together.
export interface CurrencyAccounts {
  currency: string;
  total: number;
  banks: BankAccounts[];
}

// What the "Por cuenta" card shows: the accounts per currency and then per bank, in the order given
// (the Banks board's). An active account always shows, even at zero; an archived one only while it
// still holds something (in either direction), so it never hides money. A currency's total is the sum
// of the accounts shown, which is the sum of all of them (the archived ones left out hold nothing).
// The input is never changed.
export const groupAccountBalances = (
  rows: readonly AccountBalanceRow[],
): CurrencyAccounts[] => {
  const byCurrency = new Map<string, CurrencyAccounts>();

  for (const row of rows) {
    if (row.archived && row.balance === 0) {
      continue;
    }

    const currency = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      total: 0,
      banks: [],
    };
    let bank = currency.banks.find(({ bankId }) => bankId === row.bankId);

    if (!bank) {
      bank = { bankId: row.bankId, bankName: row.bankName, accounts: [] };
      currency.banks.push(bank);
    }

    bank.accounts.push(row);
    currency.total += row.balance;
    byCurrency.set(row.currency, currency);
  }

  return [...byCurrency.values()].sort((a, b) =>
    compareCurrencyCodes(a.currency, b.currency),
  );
};
