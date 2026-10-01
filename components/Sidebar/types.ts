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
  // True for an entry that is only the current one on its own address, not on the addresses under
  // it (the "General" entry of a group shares its address with the group, and the other entries of
  // the group live under that address).
  exact?: boolean;
}
