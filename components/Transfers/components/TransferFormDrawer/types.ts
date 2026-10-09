import type { AccountChoice } from "@/core/accounts/types";

import type { FormTarget } from "../../types";

export interface TransferFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  // Every account of the user, for both account fields.
  accounts: readonly AccountChoice[];
}

export type TransferFormContentProps = Pick<
  TransferFormDrawerProps,
  "onClose" | "target" | "accounts"
>;
