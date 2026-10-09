import type { EntryCategory } from "@/components/Entries/types";
import type { AccountChoice } from "@/core/accounts/types";

import type { RepaymentValues } from "../../types";

export interface RepaymentFormProps {
  values: RepaymentValues;
  // The user's income categories.
  categories: readonly EntryCategory[];
  // Every account of the user (archived ones included): the field offers the ones of the currency.
  accounts: readonly AccountChoice[];
  // The live line under the inputs ("6 cuotas de ... · total ..."), or null while the data is not
  // enough to work it out.
  preview: string | null;
  onChange: (patch: Partial<RepaymentValues>) => void;
}
