import type { ReactNode } from "react";

export interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
}

export interface SidebarProviderProps {
  children: ReactNode;
}
