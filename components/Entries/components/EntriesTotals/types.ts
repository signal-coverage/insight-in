import type { Source } from "@/components/shared/Await";

import type { TotalRow } from "../../types";

export interface EntriesTotalsProps {
  // The totals, or a promise of them while they are still loading.
  totals: Source<readonly TotalRow[]>;
  // Forces the skeleton even when the totals are already here, e.g. while a filter change is
  // fetching the next ones: showing the old figures would read as the result of the new filters.
  isLoading?: boolean;
  // The words of the side the totals belong to ("Cobrado" / "Por cobrar" for incomes,
  // "Pagado" / "Por pagar" for expenses).
  ariaLabel: string;
  settledLabel: string;
  pendingLabel: string;
}
