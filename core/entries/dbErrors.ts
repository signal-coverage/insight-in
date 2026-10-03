// Prisma reports constraint violations through an error code; the services map the ones they
// can act on (a duplicate name, a category still in use) to their own errors.
const hasErrorCode = (error: unknown, code: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === code;

export const isUniqueConstraintError = (error: unknown): boolean =>
  hasErrorCode(error, "P2002");

export const isForeignKeyError = (error: unknown): boolean =>
  hasErrorCode(error, "P2003");
