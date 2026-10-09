import type { Source } from "@/components/shared/Await";
import type { AccountChoice } from "@/core/accounts/types";

import type { TransferFilters } from "../../types";

export interface TransfersFiltersProps {
  filters: TransferFilters;
  // Every account of the user, or a promise of them while they load: only the two selects wait for
  // them, the search works at once.
  accounts: Source<readonly AccountChoice[]>;
  // Whether anything narrows the list: the parent decides, the bar only shows the button.
  canClear: boolean;
  onChange: (patch: Partial<TransferFilters>) => void;
  onClear: () => void;
}
