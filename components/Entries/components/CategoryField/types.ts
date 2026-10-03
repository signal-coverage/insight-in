import type {
  CategoryActionResult,
  EntryCategory,
} from "@/components/Entries/types";

export interface CategoryFieldProps {
  categories: readonly EntryCategory[];
  defaultCategoryId: string | null;
  // Creates a category on the server; the field adds it to its list and selects it.
  onCreate: (name: string) => Promise<CategoryActionResult>;
  // For a parent that needs the choice before the form is submitted (the field still submits on
  // its own). Called with the category that gets selected, picked or just created.
  onChange?: (categoryId: string) => void;
}
