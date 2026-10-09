"use server";

import { revalidatePath } from "next/cache";

import {
  failure,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";

import { OVERVIEW_PATH, SETTINGS_PATH } from "./consts";
import {
  hiddenSummaryCurrenciesSchema,
  includeExpectedIncomesSchema,
} from "./schema";
import {
  saveHiddenSummaryCurrencies,
  saveIncludeExpectedIncomes,
} from "./service";
import type { SettingsActionResult } from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("settings", run);

// The "Sumar ingresos por cobrar" switch of the summary. Nothing from the payload decides who the
// owner is.
export async function saveIncludeExpectedIncomesAction(
  value: unknown,
): Promise<SettingsActionResult> {
  return runAuthenticated<SettingsActionResult>(async (userId) => {
    const parsed = includeExpectedIncomesSchema.safeParse(value);

    if (!parsed.success) {
      return failure(parsed.error.issues[0].message);
    }

    await saveIncludeExpectedIncomes(userId, parsed.data);
    revalidatePath(OVERVIEW_PATH);
    revalidatePath(SETTINGS_PATH);

    return { status: "success" };
  });
}

// The currencies the user hides from the summary tabs. Display only: nothing else changes, so only
// the summary is refreshed.
export async function saveHiddenSummaryCurrenciesAction(
  value: unknown,
): Promise<SettingsActionResult> {
  return runAuthenticated<SettingsActionResult>(async (userId) => {
    const parsed = hiddenSummaryCurrenciesSchema.safeParse(value);

    if (!parsed.success) {
      return failure(parsed.error.issues[0].message);
    }

    await saveHiddenSummaryCurrencies(userId, parsed.data);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success" };
  });
}
