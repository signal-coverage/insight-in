import type { ReactNode } from "react";

export interface SettingsSectionProps {
  // Names the heading, so the section is a labelled region of the page.
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}
