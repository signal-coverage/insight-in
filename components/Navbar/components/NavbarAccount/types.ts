import type { ComponentType, SVGProps } from "react";

export type AccountMenuIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface AccountMenuEntry {
  id: string;
  label: string;
  icon: AccountMenuIcon;
}
