import type { ComponentType, ReactNode, SVGProps } from "react";

import type { RowTone } from "../../types";

export interface CardRowProps {
  // What the row holds, for assistive technology ("Ingresos en ARS").
  label: string;
  // What the row is, written where everyone can read it ("Ingresos").
  title: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Colours the title for the side of the budget the row is about.
  tone: RowTone;
  children: ReactNode;
}
