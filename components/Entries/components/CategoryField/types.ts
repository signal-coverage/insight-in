import type {
  CategoryActionResult,
  EntryCategory,
} from "@/components/Entries/types";

export interface CategoryFieldProps {
  categories: readonly EntryCategory[];
  defaultCategoryId: string | null;
  // Creates a category on the server; the field adds it to its list and selects it.
  onCreate: (name: string) => Promise<CategoryActionResult>;
}
