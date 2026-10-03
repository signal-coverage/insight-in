// A Dinero-like descriptor of a crypto asset. `exponent` is the number of decimals the app keeps
// for it: amounts are stored as whole minor units of 10^-exponent.
export interface CryptoCurrency {
  code: string;
  name: string;
  exponent: number;
}
