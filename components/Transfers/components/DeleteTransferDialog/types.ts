import type { TransferRow } from "../../types";

export interface DeleteTransferDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Called with the id about to go, once the delete is confirmed and before it is awaited.
  onDeleting: (ids: readonly string[]) => void;
  transfer: TransferRow | null;
}

export type DeleteTransferContentProps = Pick<
  DeleteTransferDialogProps,
  "transfer" | "onClose" | "onDeleting"
>;
