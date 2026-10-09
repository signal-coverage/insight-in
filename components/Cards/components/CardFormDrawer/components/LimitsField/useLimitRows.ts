import { useState } from "react";

import type { LimitDraft, LimitsFieldProps } from "./types";
import { firstFreeCurrency, initialRows } from "./utils";

// The rows of the caps list: added in the next free currency, removed (never the last one), and
// changed as the user picks a currency or types an amount.
export function useLimitRows(defaults: LimitsFieldProps["defaultLimits"]) {
  const [rows, setRows] = useState<LimitDraft[]>(() => initialRows(defaults));
  const [nextKey, setNextKey] = useState(() => Math.max(defaults.length, 1));
  const freeCurrency = firstFreeCurrency(rows.map(({ currency }) => currency));

  const add = () => {
    if (freeCurrency === null) {
      return;
    }

    setRows((current) => [
      ...current,
      { key: nextKey, currency: freeCurrency, amount: "" },
    ]);
    setNextKey((key) => key + 1);
  };

  const remove = (key: number) =>
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.key !== key) : current,
    );

  const change = (
    key: number,
    patch: Partial<Pick<LimitDraft, "currency" | "amount">>,
  ) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  return { rows, add, remove, change, canAdd: freeCurrency !== null };
}
