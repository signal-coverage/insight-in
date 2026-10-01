export const RESOLVE_LABEL = "Resolver";

export const pendingMessage = (count: number): string =>
  count === 1
    ? "Tenés 1 gasto recurrente sin resolver este mes."
    : `Tenés ${count} gastos recurrentes sin resolver este mes.`;
