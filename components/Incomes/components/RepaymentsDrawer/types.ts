import type { RepaymentData } from "../../types";

export interface RepaymentsDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Remounts the drawer on every opening, so each one starts with no choice made.
  sessionKey: number;
  data: RepaymentData;
}

export type RepaymentsContentProps = Pick<
  RepaymentsDrawerProps,
  "onClose" | "data"
>;
