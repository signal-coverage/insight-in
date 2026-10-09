import { prisma } from "@/infrastructure/db/client";

import {
  DEFAULT_CASH_ACCOUNT_NAME,
  DEFAULT_CASH_BANK_NAME,
  DEFAULT_CASH_CURRENCY,
} from "./consts";

// A user with no banks at all gets a bank "Efectivo" with an account "Efectivo" in ARS. Both
// inserts are createMany + skipDuplicates (ON CONFLICT DO NOTHING), so the seeding is idempotent and
// safe when two requests race: the unique constraints decide, and the second request simply finds
// what the first one wrote. It runs in one transaction, so a failure never leaves a bank without
// its account. A user who already has any bank (even a renamed or archived default) is left alone.
export const ensureDefaultCash = async (userId: string): Promise<void> => {
  const existing = await prisma.bank.count({ where: { userId } });

  if (existing > 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.bank.createMany({
      data: [{ userId, name: DEFAULT_CASH_BANK_NAME }],
      skipDuplicates: true,
    });

    const bank = await tx.bank.findFirst({
      where: { userId, name: DEFAULT_CASH_BANK_NAME },
      select: { id: true },
    });

    if (!bank) {
      throw new Error("The default cash bank could not be read back");
    }

    await tx.account.createMany({
      data: [
        {
          userId,
          bankId: bank.id,
          name: DEFAULT_CASH_ACCOUNT_NAME,
          currency: DEFAULT_CASH_CURRENCY,
        },
      ],
      skipDuplicates: true,
    });
  });
};
