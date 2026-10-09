import { useOptimistic, useState, useTransition } from "react";

import { GENERIC_ERROR_MESSAGE } from "@/core/incomes/consts";
import type { SettingsActionResult } from "@/core/settings/types";

// A yes/no setting that answers at once, before the server has saved anything.
//
// The value just chosen lives in React's optimistic state, which stays for as long as the transition
// that saves it, and that includes the refresh the save causes: the real value is swapped in only
// when the transition commits with it, so the switch never flickers back to the old value in
// between. If the save fails, the transition ends with the saved value unchanged, so the switch
// goes back by itself, and the reason is kept for the caller to show.
export const useOptimisticSetting = (
  saved: boolean,
  save: (value: boolean) => Promise<SettingsActionResult>,
) => {
  const [value, setOptimisticValue] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const change = (next: boolean) => {
    startTransition(async () => {
      setError(null);
      setOptimisticValue(next);

      let result: SettingsActionResult;

      try {
        result = await save(next);
      } catch {
        result = { status: "error", message: GENERIC_ERROR_MESSAGE };
      }

      if (result.status === "error") {
        // After an await the update is no longer part of the transition unless it is wrapped again:
        // it must land together with the switch going back.
        startTransition(() => setError(result.message));
      }
    });
  };

  return { value, error, isPending, change };
};
