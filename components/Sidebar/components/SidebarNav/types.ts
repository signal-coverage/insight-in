import type { NavSection } from "../../types";

export interface SidebarNavProps {
  sections: readonly NavSection[];
  isCollapsed: boolean;
  isSearchActive?: boolean;
}
