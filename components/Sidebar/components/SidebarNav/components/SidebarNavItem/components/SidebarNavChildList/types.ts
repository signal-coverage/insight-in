import type { NavItem } from "../../../../../../types";

export type SidebarNavChildListVariant = "tree" | "flyout";

export interface SidebarNavChildListProps {
  items: readonly NavItem[];
  variant: SidebarNavChildListVariant;
}
