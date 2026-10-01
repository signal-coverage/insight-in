import type { EntryCategory } from "@/components/Entries/types";

import type { FormTarget } from "../../types";

export interface ExpenseFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
  categories: readonly EntryCategory[];
}

export type ExpenseFormContentProps = Pick<
  ExpenseFormDrawerProps,
  "onClose" | "target" | "categories"
>;
