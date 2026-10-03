import type {
  CategoryActionResult,
  EntryCategory,
} from "@/components/Entries/types";

export interface AddCategoryRowProps {
  onCreate: (name: string) => Promise<CategoryActionResult>;
  // Called once the category exists on the server, so the list can show it.
  onAdded: (category: EntryCategory) => void;
}
