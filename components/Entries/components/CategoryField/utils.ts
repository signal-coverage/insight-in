import type { EntryCategory } from "@/components/Entries/types";

// Base categories (from the server) plus any created while the drawer is open, deduplicated
// by id and sorted by name like the server's own list.
export const mergeCategories = (
  base: readonly EntryCategory[],
  added: readonly EntryCategory[],
): EntryCategory[] => {
  const knownIds = new Set(base.map((category) => category.id));
  const extra = added.filter((category) => !knownIds.has(category.id));

  return [...base, ...extra].sort((a, b) => a.name.localeCompare(b.name));
};
