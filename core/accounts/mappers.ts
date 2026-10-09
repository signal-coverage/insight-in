import type { Account as AccountRow } from "@/lib/generated/prisma/client";

import type { Account } from "./types";

// The row as the client reads it: no owner, and the archive date as a flag.
export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  bankId: row.bankId,
  name: row.name,
  currency: row.currency,
  archived: row.archivedAt !== null,
});
