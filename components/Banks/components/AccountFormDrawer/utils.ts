import { DEFAULT_BANK_KIND } from "@/core/banks/consts";
import type { Bank, BankKind } from "@/core/banks/types";
import { isCryptoCode } from "@/core/currencies/crypto";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

// The bank the drawer opens with: the one asked for (the "+ Nueva cuenta" card of a bank) when it is among
// the banks an account can be created in, else the only bank when there is exactly one, else none.
export const pickDefaultBankId = (
  bankId: string | null,
  banks: readonly Bank[],
): string | undefined => {
  if (bankId !== null && banks.some((bank) => bank.id === bankId)) {
    return bankId;
  }

  return banks.length === 1 ? banks[0].id : undefined;
};

// The kind of the bank an account goes to (or is in). A bank that is not among the drawer's banks (an
// archived one) counts as an entity: the server decides anyway.
export const kindOfBank = (
  bankId: string | null,
  banks: readonly Bank[],
): BankKind =>
  banks.find((bank) => bank.id === bankId)?.kind ?? DEFAULT_BANK_KIND;

// The crypto currencies are offered in a wallet, and to an account that already holds one (so its
// currency always shows in the field).
export const offersCrypto = (kind: BankKind, currency: string): boolean =>
  kind === "WALLET" || isCryptoCode(currency);

// The currency to keep when the bank changes: a crypto currency goes back to pesos in an entity.
export const currencyForKind = (currency: string, kind: BankKind): string =>
  kind === "ENTITY" && isCryptoCode(currency)
    ? DEFAULT_CURRENCY_CODE
    : currency;
