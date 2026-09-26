"use client";

import { useCallback, useMemo, useState } from "react";

import { SidebarContext } from "./consts";
import type { SidebarProviderProps } from "./types";

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggle = useCallback(() => setIsCollapsed((current) => !current), []);
  const value = useMemo(() => ({ isCollapsed, toggle }), [isCollapsed, toggle]);

  return <SidebarContext value={value}>{children}</SidebarContext>;
}
