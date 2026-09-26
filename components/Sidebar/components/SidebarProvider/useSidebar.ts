"use client";

import { useContext } from "react";

import { MISSING_PROVIDER_MESSAGE, SidebarContext } from "./consts";
import type { SidebarContextValue } from "./types";

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);

  if (context === null) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }

  return context;
}
