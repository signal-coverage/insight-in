export const DEBIT_ACCOUNT_LABEL = "Cuenta";
export const DEBIT_ACCOUNT_HINT =
  "La define la tarjeta: la cuenta de su banco en la moneda del gasto.";

// "Se descuenta de Banco Galicia · Caja de ahorro".
export const debitAccountText = (label: string): string =>
  `Se descuenta de ${label}`;
