import { z } from "zod";

// More rows than a person could select by hand; keeps a forged payload from asking for thousands of
// deletes at once.
export const MAX_BULK_DELETE = 200;

export const BULK_INVALID_MESSAGE =
  "No se pudo eliminar la selección. Actualizá la página e intentá de nuevo.";

// The ids a bulk delete receives: at least one and at most MAX_BULK_DELETE, each once.
export const bulkIdsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(MAX_BULK_DELETE)
  .transform((ids) => [...new Set(ids)]);
