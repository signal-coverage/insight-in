import type { CategoryWithCount } from "@/components/Entries/types";

export interface DeleteCategoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  category: CategoryWithCount | null;
  // Runs the delete and reports the outcome itself (row error or removal), then the
  // dialog closes.
  onConfirm: () => Promise<void>;
}
