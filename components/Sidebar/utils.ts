import type { NavItem, NavSection } from "./types";

const matchesLabel = (label: string, query: string): boolean =>
  label.toLowerCase().includes(query);

const filterNavItem = (item: NavItem, query: string): NavItem | null => {
  if (matchesLabel(item.label, query)) {
    return item;
  }

  const matchingChildren = (item.children ?? []).filter((child) =>
    matchesLabel(child.label, query),
  );

  if (matchingChildren.length === 0) {
    return null;
  }

  return { ...item, children: matchingChildren };
};

// Keeps a parent when its own label matches (showing every child unchanged) or when at
// least one child matches (showing the parent with only the matching children).
export const filterNavItems = (
  items: readonly NavItem[],
  query: string,
): readonly NavItem[] => {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return items;
  }

  return items.reduce<NavItem[]>((acc, item) => {
    const filtered = filterNavItem(item, trimmed);

    if (filtered) {
      acc.push(filtered);
    }

    return acc;
  }, []);
};

// Filters every section with the same rules; a section left with no item disappears with its title.
export const filterNavSections = (
  sections: readonly NavSection[],
  query: string,
): readonly NavSection[] => {
  if (!query.trim()) {
    return sections;
  }

  return sections.reduce<NavSection[]>((acc, section) => {
    const items = filterNavItems(section.items, query);

    if (items.length > 0) {
      acc.push({ ...section, items });
    }

    return acc;
  }, []);
};
