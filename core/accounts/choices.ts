import { prisma } from "@/infrastructure/db/client";

import { ensureDefaultCash } from "./defaultCash";
import { accountLabel } from "./label";
import type { AccountChoice } from "./types";

// The accounts the entry forms can offer, in the order of the Banks board (bank, then account, by
// creation). Archived ones come along, flagged: a form shows one only to the record that already has
// it. The first time anything needs accounts the default cash account is seeded (idempotent), so a
// new user always has one to pick. Scoped by userId.
export const listAccountChoices = async (
  userId: string,
): Promise<AccountChoice[]> => {
  await ensureDefaultCash(userId);

  const rows = await prisma.account.findMany({
    where: { userId },
    include: { bank: { select: { name: true } } },
    orderBy: [
      { bank: { createdAt: "asc" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    currency: row.currency,
    label: accountLabel(row.bank.name, row.name),
    archived: row.archivedAt !== null,
  }));
};
