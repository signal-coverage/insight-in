// How the planner's single amount is read.
export const AMOUNT_MODES = ["total", "perInstallment"] as const;

// Whose card pays the purchase: one of the user's own cards (digital money, dates from its cycle) or
// one borrowed from somebody else (no card record, so no cycle; the user repays the lender).
export const CARD_OWNERSHIPS = ["own", "borrowed"] as const;

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 60;

// How many installments the planners start with: a year of them.
export const DEFAULT_TOTAL_CUOTAS = 12;

// Room for " (60/60)" after the product in the description of an installment.
export const INSTALLMENT_SUFFIX_LENGTH = 8;

// More plans than a person could have; keeps a forged payload from asking for thousands of writes.
export const MAX_INSTALLMENT_COUNTS = 200;

export const INSTALLMENT_FORM_INVALID_MESSAGE =
  "No se pudo guardar la compra. Revisá los datos e intentá de nuevo.";

export const INSTALLMENT_COUNTS_INVALID_MESSAGE =
  "No se pudieron aplicar las cuotas. Revisá los datos e intentá de nuevo.";

export const invalidInstallmentCountMessage = (description: string): string =>
  `«${description}» no tiene tantas cuotas pendientes. Revisá la cantidad.`;

export const INSTALLMENT_PLAN_NOT_FOUND_MESSAGE =
  "No se encontró el plan de cuotas. Actualizá la página e intentá de nuevo.";

export const LAST_INSTALLMENT_OUT_OF_RANGE_MESSAGE =
  "La última cuota quedaría fuera de los años 2000 a 2099.";

export const CARD_OWNERSHIP_REQUIRED_MESSAGE =
  "Elegí si la tarjeta es propia o prestada.";

export const OWN_CARD_REQUIRED_MESSAGE = "Elegí una tarjeta.";

export const BORROWED_CARD_WITH_ID_MESSAGE =
  "Una tarjeta prestada no se elige entre tus tarjetas.";
