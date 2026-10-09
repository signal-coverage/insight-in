import type { Prisma } from "@/lib/generated/prisma/client";

// The order of the Banks board: banks by creation, then each bank's accounts by creation (the ids break
// ties, so the order is the same on every read). Every list that must line up with the board uses it.
export const ACCOUNTS_IN_BOARD_ORDER: Prisma.AccountOrderByWithRelationInput[] =
  [
    { bank: { createdAt: "asc" } },
    { bank: { id: "asc" } },
    { createdAt: "asc" },
    { id: "asc" },
  ];
