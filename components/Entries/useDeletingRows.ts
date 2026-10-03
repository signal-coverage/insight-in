import { useOptimistic } from "react";

// One object for every render: a new Set each time would count as a new base state.
const NO_ROWS: ReadonlySet<string> = new Set();
const NO_PLANS: ReadonlySet<string> = new Set();

// The rows a delete is working on, from the moment it is confirmed until the refreshed rows are on
// screen: until then the table still shows them, and they must read as on their way out and not be
// acted on.
//
// Like the status checkbox (see useOptimisticStatus), this lives in React's optimistic state, which
// stays for as long as the transition that deletes, and that includes the refresh the delete causes:
// the real rows are swapped in only when the transition commits with them, and a failed delete just
// ends the transition, which gives the rows back. `markDeleting` is called inside that transition,
// before the delete is awaited.
//
// Deleting a whole plan in installments goes away with every row of the plan, so it is marked by plan
// id (`markDeletingPlan`): the table then also treats the rows of that plan as on their way out (see
// withPlanRows).
export const useDeletingRows = () => {
  const [deletingIds, markDeleting] = useOptimistic<
    ReadonlySet<string>,
    readonly string[]
  >(NO_ROWS, (_current, ids) => new Set(ids));

  const [deletingPlanIds, markDeletingPlan] = useOptimistic<
    ReadonlySet<string>,
    string
  >(NO_PLANS, (_current, planId) => new Set([planId]));

  return { deletingIds, markDeleting, deletingPlanIds, markDeletingPlan };
};
