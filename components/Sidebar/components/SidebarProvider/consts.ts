import { createContext } from "react";

import type { SidebarContextValue } from "./types";

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export const MISSING_PROVIDER_MESSAGE = "useSidebar must be used within a SidebarProvider";
