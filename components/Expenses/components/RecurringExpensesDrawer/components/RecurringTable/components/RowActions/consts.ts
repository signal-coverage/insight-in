export const ENABLE_LABEL = "Habilitar";
export const ENABLE_PENDING_LABEL = "Habilitando…";
export const DISABLE_LABEL = "Deshabilitar";

// Accessible names: the buttons repeat on every row, so each one says which expense it is for.
export const removeLabel = (description: string): string =>
  `Quitar ${description}`;
export const enableAriaLabel = (description: string): string =>
  `Habilitar ${description} este mes`;
export const disableAriaLabel = (description: string): string =>
  `Deshabilitar ${description} este mes`;
