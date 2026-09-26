"use client";

import { SidebarHeader } from "./components/SidebarHeader";
import { SidebarNav } from "./components/SidebarNav";
import { useSidebar } from "./components/SidebarProvider";
import { NAV_ITEMS } from "./consts";
import { getRootClassName } from "./styles";

export function Sidebar() {
  const { isCollapsed } = useSidebar();

  return (
    <aside className={getRootClassName(isCollapsed)}>
      <SidebarHeader isCollapsed={isCollapsed} />
      <SidebarNav items={NAV_ITEMS} isCollapsed={isCollapsed} />
    </aside>
  );
}
