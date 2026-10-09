import { useOptimistic, useState, useTransition } from "react";

import { GENERIC_ERROR_MESSAGE } from "@/core/incomes/consts";
import type { SettingsActionResult } from "@/core/settings/types";

// The list of hidden currencies, answering at once while the server saves it. Same idea as the
// expected incomes switch: the chosen list lives in React's optimistic state for as long as the
// transition that saves it (refresh included), so a box never flickers back in between; when the
// save fails the transition ends with the saved list unchanged, so the box goes back by itself and
// the reason is kept for the caller to show.
export const useHiddenCurrencies = (
  saved: readonly string[],
  save: (hidden: string[]) => Promise<SettingsActionResult>,
) => {
  const [hidden, setOptimisticHidden] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const change = (next: string[]) => {
    startTransition(async () => {
      setError(null);
      setOptimisticHidden(next);

      let result: SettingsActionResult;

      try {
        result = await save(next);
      } catch {
        result = { status: "error", message: GENERIC_ERROR_MESSAGE };
      }

      if (result.status === "error") {
        // After an await the update is no longer part of the transition unless it is wrapped again:
        // it must land together with the box going back.
        startTransition(() => setError(result.message));
      }
    });
  };

  return { hidden, error, isPending, change };
};
