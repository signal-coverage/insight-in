import type {
  CategoryActions,
  CategoryWithCount,
} from "@/components/Entries/types";

// The words the drawer shows, so the same drawer serves income and expense categories.
export interface ManageCategoriesCopy {
  heading: string;
  description: string;
  listAriaLabel: string;
  // "Sin ingresos", "1 ingreso", "3 ingresos" (or their expense counterparts).
  countLabel: (count: number) => string;
}

export interface ManageCategoriesDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  categories: readonly CategoryWithCount[];
  copy: ManageCategoriesCopy;
  actions: CategoryActions;
}

export type ManageCategoriesContentProps = Pick<
  ManageCategoriesDrawerProps,
  "onClose" | "categories" | "copy" | "actions"
>;
