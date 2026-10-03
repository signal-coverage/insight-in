import type { BoardItem } from "@/core/roadmap/types";

export interface DeleteItemDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  item: BoardItem | null;
}

export type DeleteItemContentProps = Pick<
  DeleteItemDialogProps,
  "item" | "onClose"
>;
