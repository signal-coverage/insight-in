import type { CategoryWithCount } from "@/components/Entries/types";

export const sortCategories = (
  categories: readonly CategoryWithCount[],
): CategoryWithCount[] =>
  [...categories].sort((a, b) => a.name.localeCompare(b.name, "es"));
