import { listAccountChoices } from "@/core/accounts/choices";

import { listTransfers } from "./service";

// Everything the transfers page needs: the month's transfers and every account of the user (for the
// form and the filters; the first visit seeds the default cash account, so a user never lands without
// one). The two reads are independent, so they run together.
export const loadTransfersPageData = async (userId: string, month: string) => {
  const [transfers, accounts] = await Promise.all([
    listTransfers(userId, month),
    listAccountChoices(userId),
  ]);

  return { transfers, accounts };
};
