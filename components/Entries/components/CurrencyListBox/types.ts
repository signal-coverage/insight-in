export interface CurrencyListBoxProps {
  // Whether the field takes a crypto currency too (an entry, a transfer, a wallet's account).
  includeCrypto: boolean;
  // With `includeCrypto`, lists the crypto group before the legal-tender one (a wallet's account).
  cryptoFirst?: boolean;
}
