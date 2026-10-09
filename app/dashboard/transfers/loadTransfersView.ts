import { toTransferRows } from "@/components/Transfers/utils";
import { loadTransfersPageData } from "@/core/transfers/pageData";

// Starts loading everything the page needs and returns immediately, without awaiting it: one promise
// per section, both derived from the same single load. The page hands them straight to the client
// component, so the page's structure renders at once and the table and the account selects wait for
// just their own piece.
//
// The promises are created here, once per request, so their identity is stable: a client component
// that waits on one gets the same promise on every render.
export const loadTransfersView = (userId: string, month: string) => {
  const data = loadTransfersPageData(userId, month);

  return {
    table: data.then(({ transfers }) => ({ rows: toTransferRows(transfers) })),
    accounts: data.then(({ accounts }) => accounts),
  };
};
