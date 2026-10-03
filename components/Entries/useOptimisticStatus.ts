import { useOptimistic, useTransition } from "react";

import type { EntryStatus } from "@/core/entries/status";

type StatusOverrides = Record<string, EntryStatus>;

// One object for every render: a new {} each time would count as a new base state.
const NO_OVERRIDES: StatusOverrides = {};

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

  const toggle = (id: string, isSettled: boolean) => {
    const status: EntryStatus = isSettled ? "SETTLED" : "PLANNED";

    startTransition(async () => {
      addOverride({ id, status });
      await save(id, status);
    });
  };

  // The rows with the statuses just given on top of the ones the server sent.
  const apply = <Row extends { id: string; status: EntryStatus }>(
    rows: readonly Row[],
  ): Row[] =>
    rows.map((row) =>
      overrides[row.id] ? { ...row, status: overrides[row.id] } : row,
    );

  return { toggle, apply };
};
