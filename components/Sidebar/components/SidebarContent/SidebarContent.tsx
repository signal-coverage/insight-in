"use client";

import { useMemo, useState } from "react";

import { NAV_SECTIONS } from "../../consts";
import { filterNavSections } from "../../utils";
import { SidebarFooter } from "../SidebarFooter";
import { SidebarHeader } from "../SidebarHeader";
import { SidebarNav } from "../SidebarNav";
import { SidebarSearch } from "../SidebarSearch";
import type { SidebarContentProps } from "./types";

// Everything inside the sidebar card: shared by the fixed desktop sidebar and the mobile overlay.
export function SidebarContent({ isCollapsed }: SidebarContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isSearchActive = searchQuery.trim().length > 0;
  const filteredSections = useMemo(
    () => filterNavSections(NAV_SECTIONS, searchQuery),
    [searchQuery],
  );

  return (
    <>
      <SidebarHeader isCollapsed={isCollapsed} />
      {!isCollapsed && (
        <SidebarSearch value={searchQuery} onChange={setSearchQuery} />
      )}
      <SidebarNav
        sections={filteredSections}
        isCollapsed={isCollapsed}
        isSearchActive={isSearchActive}
      />
      <SidebarFooter isCollapsed={isCollapsed} />
    </>
  );
}
