import type { EntryCategory } from "@/components/Entries/types";

import type { RecurringRow } from "../../../../types";

// What the drawer is showing. The key remounts the form on every opening, so each one starts from
// the template's values with no errors left from the last time.
export interface TemplateFormTarget {
  key: number;
  template: RecurringRow | null;
}

export interface TemplateFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: TemplateFormTarget;
  categories: readonly EntryCategory[];
}

export interface TemplateFormContentProps {
  template: RecurringRow;
  categories: readonly EntryCategory[];
  onClose: () => void;
}
