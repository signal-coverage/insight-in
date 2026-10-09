export const LIMITS_LABEL = "Topes por moneda";
export const LIMITS_HINT =
  "Cada tope puede ser el límite real de la tarjeta o uno menor que quieras respetar. Los topes de distintas monedas nunca se suman.";
export const ADD_LIMIT_LABEL = "Agregar un tope en otra moneda";
export const LIMIT_CURRENCY_LABEL = "Moneda del tope";
export const LIMIT_AMOUNT_LABEL = "Monto del tope";
export const LIMIT_AMOUNT_PLACEHOLDER = "0.00";

export const removeLimitLabel = (currency: string): string =>
  `Quitar el tope en ${currency}`;
