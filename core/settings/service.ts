import { prisma } from "@/infrastructure/db/client";

import { DEFAULT_SETTINGS } from "./consts";
import type { UserSettings } from "./types";

// The user's settings, or the defaults when they never saved one (there is no row until then).
export const getUserSettings = async (
  userId: string,
): Promise<UserSettings> => {
  const row = await prisma.userSettings.findUnique({ where: { userId } });

  if (row === null) {
    return { ...DEFAULT_SETTINGS };
  }

  return { includeExpectedIncomes: row.includeExpectedIncomes };
};

// Creates the user's row the first time they change a setting, and updates it afterwards.
export const saveIncludeExpectedIncomes = async (
  userId: string,
  includeExpectedIncomes: boolean,
): Promise<void> => {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, includeExpectedIncomes },
    update: { includeExpectedIncomes },
  });
};
