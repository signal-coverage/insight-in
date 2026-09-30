import type { NavItem } from "../../../../../../types";

export interface SidebarNavItemGroupProps {
  item: NavItem;
  isCollapsed: boolean;
  forceExpanded?: boolean;
}
