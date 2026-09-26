import type { NavItem } from "../../types";

export interface SidebarNavProps {
  items: readonly NavItem[];
  isCollapsed: boolean;
}
