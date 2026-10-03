import type { CardRow } from "../../types";

export interface DeleteCardDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Called with the id about to go, once the delete is confirmed and before it is awaited.
  onDeleting: (ids: readonly string[]) => void;
  card: CardRow | null;
}

export type DeleteCardContentProps = Pick<
  DeleteCardDialogProps,
  "card" | "onClose" | "onDeleting"
>;
