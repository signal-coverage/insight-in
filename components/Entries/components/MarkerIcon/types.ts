import type { ComponentType, SVGProps } from "react";

export interface MarkerIconProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // What the marker says: its accessible name and its tooltip.
  label: string;
  // The tooltip, when it has more to say than the accessible name; it defaults to the label.
  tooltip?: string;
  className?: string;
}
