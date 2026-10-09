import type { ReactNode } from "react";

export interface SidebarContextValue {
  isCollapsed: boolean;
  toggle: () => void;
  // The overlay panel that replaces the fixed sidebar below the md breakpoint.
  isMobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  setMobileOpen: (isOpen: boolean) => void;
}

export interface SidebarProviderProps {
  children: ReactNode;
}
