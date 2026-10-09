import type { BankFormTarget } from "../../types";

export interface BankFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: BankFormTarget;
}

export type BankFormContentProps = Pick<
  BankFormDrawerProps,
  "onClose" | "target"
>;
