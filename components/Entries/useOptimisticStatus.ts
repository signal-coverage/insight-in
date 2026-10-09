import { useOptimistic, useRef, useState, useTransition } from "react";

import type { EntryStatus } from "@/core/entries/status";

type StatusOverrides = Record<string, EntryStatus>;

// One object for every render: a new {} each time would count as a new base state.
const NO_OVERRIDES: StatusOverrides = {};

// What a save that refused the change says, if anything. The optimistic status goes back by itself;
// this keeps the reason, for the page to show.
const refusalOf = (result: unknown): string | null =>
  typeof result === "object" &&
  result !== null &&
  "status" in result &&
  result.status === "error" &&
  "message" in result &&
  typeof result.message === "string"
    ? result.message
    : null;

interface StatusChange {
  id: string;
  status: EntryStatus;
}

// The status checkbox of a row answers at once, before the server has saved anything.
//
// The status a row was just given lives in React's optimistic state, which stays for as long as
// the transition that saves it, and that includes the refresh the save causes: the real rows are
// swapped in only when the transition commits with them. Clearing it by hand as soon as the save
// has answered (what this replaced) left a gap, because the refreshed rows arrive a moment later:
// the checkbox flipped, flipped back to the old status, and only then settled on the new one.
export const useOptimisticStatus = (
  save: (id: string, status: EntryStatus) => Promise<unknown>,
) => {
  const [overrides, addOverride] = useOptimistic<StatusOverrides, StatusChange>(
    NO_OVERRIDES,
    (current, { id, status }) => ({ ...current, [id]: status }),
  );
  const [, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<string | null>(null);
  // Which toggle is the latest: two quick ticks can be answered out of order, and only the answer of
  // the last one may set or clear the refusal.
  const latest = useRef(0);

  const toggle = (id: string, isSettled: boolean) => {
    const status: EntryStatus = isSettled ? "SETTLED" : "PLANNED";

    const request = ++latest.current;

    setRefusal(null);
    startTransition(async () => {
      addOverride({ id, status });

      const result = await save(id, status);

      if (request === latest.current) {
        setRefusal(refusalOf(result));
      }
    });
  };

  // The rows with the statuses just given on top of the ones the server sent.
  const apply = <Row extends { id: string; status: EntryStatus }>(
    rows: readonly Row[],
  ): Row[] =>
    rows.map((row) =>
      overrides[row.id] ? { ...row, status: overrides[row.id] } : row,
    );

  return { toggle, apply, refusal };
};
