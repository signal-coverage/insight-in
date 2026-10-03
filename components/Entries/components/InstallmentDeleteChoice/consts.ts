import type { PlanSide } from "@/components/Entries/types";
import type { PlanProgress } from "@/core/installments/types";

export const SCOPE_LABEL = "Qué querés eliminar";

export const ENTRY_OPTION_LABEL = "Eliminar solo esta cuota";
export const ENTRY_OPTION_HINT =
  "El resto de las cuotas del plan sigue como está.";

export const PLAN_OPTION_LABEL = "Eliminar el plan completo";

export const ACKNOWLEDGE_LABEL =
  "Entiendo que se eliminan todas las cuotas del plan y que no se puede deshacer.";

export const planOptionHint = (total: number): string =>
  total === 1
    ? "Se elimina la única cuota que queda del plan."
    : `Se eliminan las ${total} cuotas del plan.`;

const cuotasLabel = (count: number): string =>
  count === 1 ? "1 cuota" : `${count} cuotas`;

// How many of the cuotas are already marked: "ninguna marcada como pagada", "1 ya marcada como pagada",
// "3 ya marcadas como pagadas". An installment of a loan is "cobrada" instead of "pagada".
const settledLabel = (side: PlanSide, settled: number): string => {
  const done = side === "expense" ? "pagada" : "cobrada";

  if (settled === 0) {
    return `ninguna marcada como ${done}`;
  }

  return settled === 1
    ? `1 ya marcada como ${done}`
    : `${settled} ya marcadas como ${done}s`;
};

// What the user is told before the whole plan goes away: how many cuotas it has and how many are
// already settled, since deleting those removes history and changes the balances.
export const planWarning = (
  side: PlanSide,
  { total, settled }: PlanProgress,
): string => {
  const counts = `Este plan tiene ${cuotasLabel(total)} en total y ${settledLabel(side, settled)}.`;

  return settled > 0
    ? `${counts} Al eliminarlo se pierde ese historial y cambian tus saldos y totales.`
    : counts;
};
