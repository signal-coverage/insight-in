import type { Bank } from "@/core/banks/types";

import type { AccountFormTarget } from "../../types";

export interface AccountFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: AccountFormTarget;
  // The banks an account can be created in: the active ones.
  banks: readonly Bank[];
}

export type AccountFormContentProps = Pick<
  AccountFormDrawerProps,
  "onClose" | "target" | "banks"
>;
