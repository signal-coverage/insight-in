import type { ReactNode } from "react";

export interface SidebarNavLinkProps {
  href: string;
  // Marks the link as the page being shown (aria-current="page").
  isActive?: boolean;
  className?: string;
  children: ReactNode;
}
