import type { ComponentType, SVGProps } from "react";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
  children?: readonly NavItem[];
  // True for demo/placeholder entries with no real page behind them yet — rendered
  // visually but not as a real navigable link, so clicking never lands on a 404.
  disabled?: boolean;
}
