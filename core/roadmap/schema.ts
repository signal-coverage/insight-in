import { z } from "zod";

import {
  BOARD_STATUSES,
  DESCRIPTION_MAX_LENGTH,
  MAX_COLUMN_INDEX,
  TITLE_MAX_LENGTH,
} from "./consts";

const titleField = z
  .string({ error: "El título es obligatorio." })
  .trim()
  .min(1, "El título es obligatorio.")
  .max(
    TITLE_MAX_LENGTH,
    `El título no puede superar los ${TITLE_MAX_LENGTH} caracteres.`,
  );

// Optional: a blank description is no description.
const descriptionField = z
  .string({ error: "La descripción no es válida." })
  .trim()
  .max(
    DESCRIPTION_MAX_LENGTH,
    `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres.`,
  )
  .optional()
  .transform((value) => (value ? value : null));

const statusField = z.enum(BOARD_STATUSES, {
  error: "Elegí una columna válida.",
});

// A whole number from 0 up to what a column could ever hold.
const indexNumber = z
  .number({ error: "La posición no es válida." })
  .int("La posición no es válida.")
  .min(0, "La posición no es válida.")
  .max(MAX_COLUMN_INDEX, "La posición no es válida.");

// What a card says: the only part of it an edit can change. Fields it does not know (an owner, a
// status) are dropped, so they can never reach the database through here.
export const updateItemSchema = z.object({
  title: titleField,
  description: descriptionField,
});

// A form can only send text, so the place a card is created at arrives as digits (or blank, for the
// end of the column) and leaves as a number.
export const createItemSchema = updateItemSchema.extend({
  status: statusField,
  index: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string({ error: "La posición no es válida." })
      .trim()
      .regex(/^\d+$/, "La posición no es válida.")
      .transform(Number)
      .pipe(indexNumber)
      .optional(),
  ),
});

// A card dropped in a column, as the client asks for it (not through a form, so a real number).
export const moveItemSchema = z.object({
  id: z.string().min(1),
  status: statusField,
  index: indexNumber,
});
