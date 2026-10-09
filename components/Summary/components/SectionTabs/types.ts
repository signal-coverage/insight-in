import type { ReactNode } from "react";

import type { SummarySection } from "@/core/summary/tabs";

export interface SectionTabsProps {
  // The section the address asks for.
  selected: SummarySection;
  onSelect: (section: SummarySection) => void;
  // What each section shows. Only the selected one is mounted, so what the others hold is never
  // rendered (nor read) until its tab is picked.
  accounts: ReactNode;
  month: ReactNode;
  history: ReactNode;
}
