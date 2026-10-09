import { createContext } from "react";

import type { SidebarContextValue } from "./types";

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export const MISSING_PROVIDER_MESSAGE =
  "useSidebar must be used within a SidebarProvider";

// Tailwind's `md`: from here up the sidebar is fixed in the layout, below it is an overlay panel.
export const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";
