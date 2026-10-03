import type { FormTarget } from "../../types";

export interface ItemFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
}

export type ItemFormContentProps = Pick<
  ItemFormDrawerProps,
  "onClose" | "target"
>;
