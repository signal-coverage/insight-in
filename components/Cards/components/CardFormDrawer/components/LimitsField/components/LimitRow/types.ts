import type { CurrencyOption } from "@/components/Entries/currencyOptions";

import type { LimitDraft } from "../../types";

export interface LimitRowProps {
  row: LimitDraft;
  // The currencies this row may pick (never one another row uses).
  currencies: readonly CurrencyOption[];
  canRemove: boolean;
  currencyError?: string;
  amountError?: string;
  onChange: (patch: Partial<Pick<LimitDraft, "currency" | "amount">>) => void;
  onRemove: () => void;
}
