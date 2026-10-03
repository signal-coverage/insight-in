import type { ComponentType, SVGProps } from "react";

export type AccountMenuIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface AccountMenuEntry {
  id: string;
  label: string;
  icon: AccountMenuIcon;
  // Where choosing the entry leads, for the entries that are a page. The others do nothing yet (Actividad, Integraciones).
  href?: string;
}

export interface AccountMenuProps {
  isCollapsed: boolean;
}
