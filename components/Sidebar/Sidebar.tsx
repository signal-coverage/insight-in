"use client";

import { SidebarContent } from "./components/SidebarContent";
import { SidebarMobileDrawer } from "./components/SidebarMobileDrawer";
import { useSidebar } from "./components/SidebarProvider";
import { SidebarToggle } from "./components/SidebarToggle";
import { CARD_CLASS_NAME, getRootClassName } from "./styles";

export function Sidebar() {
  const { isCollapsed } = useSidebar();

  return (
    <>
      <aside className={getRootClassName(isCollapsed)}>
        <div className={CARD_CLASS_NAME}>
          <SidebarContent isCollapsed={isCollapsed} />
        </div>
        <SidebarToggle />
      </aside>
      <SidebarMobileDrawer />
    </>
  );
}
