"use client";

import { useMemo, useState } from "react";

import { SidebarFooter } from "./components/SidebarFooter";
import { SidebarHeader } from "./components/SidebarHeader";
import { SidebarNav } from "./components/SidebarNav";
import { useSidebar } from "./components/SidebarProvider";
import { SidebarSearch } from "./components/SidebarSearch";
import { SidebarToggle } from "./components/SidebarToggle";
import { NAV_ITEMS } from "./consts";
import { CARD_CLASS_NAME, getRootClassName } from "./styles";
import { filterNavItems } from "./utils";

export function Sidebar() {
  const { isCollapsed } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");
  const isSearchActive = searchQuery.trim().length > 0;
  const filteredItems = useMemo(
    () => filterNavItems(NAV_ITEMS, searchQuery),
    [searchQuery],
  );

  return (
    <aside className={getRootClassName(isCollapsed)}>
      <div className={CARD_CLASS_NAME}>
        <SidebarHeader isCollapsed={isCollapsed} />
        {!isCollapsed && (
          <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
        )}
        <SidebarNav
          items={filteredItems}
          isCollapsed={isCollapsed}
          isSearchActive={isSearchActive}
        />
        <SidebarFooter isCollapsed={isCollapsed} />
      </div>
      <SidebarToggle />
    </aside>
  );
}
