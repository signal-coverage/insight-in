export const IDENTITY_LABEL = "Tipo y banco";
export const LOCKED_HINT =
  "El tipo y el banco de una tarjeta no se pueden cambiar.";

// "Crédito · Banco Galicia".
export const identityText = (kindName: string, bankName: string): string =>
  `${kindName} · ${bankName}`;
