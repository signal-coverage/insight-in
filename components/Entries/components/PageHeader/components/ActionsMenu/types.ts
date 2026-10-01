import type { ComponentType, SVGProps } from "react";

export interface ActionsMenuItem {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface ActionsMenuProps {
  // The trigger's text ("Acciones").
  label: string;
  items: readonly ActionsMenuItem[];
  // Receives the id of the item the user chose.
  onAction: (id: string) => void;
}
