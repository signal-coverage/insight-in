import { LIMIT_AMOUNT_FIELD, LIMIT_CURRENCY_FIELD } from "./consts";

const text = (value: FormDataEntryValue | undefined): string =>
  typeof value === "string" ? value : "";

// The caps of a card form: one currency and one amount per row, sent as two repeated fields in the
// same order. A value that is not text, or the missing half of a row, counts as empty, which the
// schema refuses.
export const readLimitRows = (
  formData: FormData,
): { currency: string; amount: string }[] => {
  const currencies = formData.getAll(LIMIT_CURRENCY_FIELD);
  const amounts = formData.getAll(LIMIT_AMOUNT_FIELD);

  return Array.from(
    { length: Math.max(currencies.length, amounts.length) },
    (_, index) => ({
      currency: text(currencies[index]),
      amount: text(amounts[index]),
    }),
  );
};
