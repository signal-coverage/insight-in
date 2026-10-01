import { RECURRING_SWITCH_LABEL } from "../../consts";

export const heading = (monthLabel: string): string =>
  `Gastos recurrentes de ${monthLabel}`;

export const DESCRIPTION = "Decidí qué pasa con cada uno este mes.";

export const CANCEL_LABEL = "Cancelar";
export const APPLY_LABEL = "Aplicar";
export const APPLY_PENDING_LABEL = "Aplicando…";

export const EMPTY_MESSAGE = `Todavía no tenés gastos recurrentes. Creá un gasto y activá «${RECURRING_SWITCH_LABEL}».`;
