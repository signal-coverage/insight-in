import type { ComponentType, SVGProps } from "react";

// The words (and the icon) of each variant, so the same box serves incomes and expenses.
export interface EntriesEmptyStateCopy {
  empty: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    title: string;
    hint: string;
    // The button that creates the first entry ("Agregar ingreso").
    action: string;
  };
  filtered: {
    title: string;
    hint: string;
  };
}

export interface EntriesEmptyStateProps {
  // "empty": the user has no entries at all. "filtered": entries exist, none match.
  variant: "empty" | "filtered";
  copy: EntriesEmptyStateCopy;
  // Without an action there is no button: a filtered view that is already back at its defaults
  // has nothing left to reset.
  onAction?: () => void;
}
