import type {
  CategoryActionResult,
  CategoryWithCount,
} from "@/components/Entries/types";

export interface CategoryRowProps {
  category: CategoryWithCount;
  // "Sin ingresos" / "3 gastos": how many entries use the category, already worded.
  countLabel: string;
  // A failure from an action started outside the row (a refused delete).
  error?: string;
  onRename: (id: string, name: string) => Promise<CategoryActionResult>;
  onDelete: (category: CategoryWithCount) => void;
}
