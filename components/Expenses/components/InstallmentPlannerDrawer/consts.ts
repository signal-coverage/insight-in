export const HEADING = "Compra en cuotas";

export const PURCHASE_STEP_LABEL = "Paso 1 de 2 · Datos de la compra";
export const REVIEW_STEP_LABEL = "Paso 2 de 2 · Revisá la compra";

export const CONTINUE_LABEL = "Continuar";
export const BACK_LABEL = "Volver";
export const SAVE_LABEL = "Guardar compra";
export const SAVE_PENDING_LABEL = "Guardando…";

export const saveQuestion = (count: number): string =>
  `¿Guardar la compra y crear las ${count} cuotas?`;

// The ticket's title and the heading it is named after.
export const TICKET_BRAND = "COMPRA EN CUOTAS";
export const SUMMARY_HEADING = "Resumen de la compra";

// Labels of the ticket that only a purchase has (the rest are shared, see the ticket's consts).
export const PRODUCT_LINE = "Producto";
export const CARD_LINE = "Tarjeta";

// What the card line of the ticket says about whose card it is.
export const BORROWED_CARD_VALUE = "Prestada";

export const ownCardValue = (title: string): string => `Propia · ${title}`;

// Live under the purchase date once an own card is chosen, with the date already formatted.
export const firstInstallmentLine = (date: string): string =>
  `Primera cuota: ${date}`;

// Said under the first installment on the ticket of a purchase paid with an own card.
export const firstInstallmentNextMonthNote = (date: string): string =>
  `La primera cuota entra el mes que viene (${date}).`;

export const firstInstallmentLaterNote = (
  month: string,
  date: string,
): string => `La primera cuota entra en ${month} (${date}).`;

// What the pop-up says before using an own card that charges the first installment this very month.
export const confirmationMessage = (date: string, month: string): string =>
  `La primera cuota se cobra este mes (${date}) y se va a registrar en tu resumen de ${month}.`;

// How a card suits the purchase, in words (each verdict also has an icon and a colour).
export const fitsVerdict = (left: string): string =>
  `Entra en el tope (te queda ${left})`;

export const NEAR_LIMIT_VERDICT = "Cerca del tope";

export const exceededVerdict = (excess: string): string =>
  `Se pasa del tope por ${excess}`;
