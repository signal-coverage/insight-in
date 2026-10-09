"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DESKTOP_MEDIA_QUERY, SidebarContext } from "./consts";
import type { SidebarProviderProps } from "./types";

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => setIsCollapsed((current) => !current), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Growing to the desktop breakpoint swaps the overlay for the fixed sidebar: close the overlay
  // so no backdrop is left behind.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = (event: { matches: boolean }) => {
      if (event.matches) {
        setMobileOpen(false);
      }
    };

    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(
    () => ({
      isCollapsed,
      toggle,
      isMobileOpen,
      openMobile,
      closeMobile,
      setMobileOpen,
    }),
    [isCollapsed, toggle, isMobileOpen, openMobile, closeMobile],
  );

  return <SidebarContext value={value}>{children}</SidebarContext>;
}
