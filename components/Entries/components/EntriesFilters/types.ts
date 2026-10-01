import type { Source } from "@/components/shared/Await";
import type { EntriesQuery } from "@/core/entries/query";
import type { EntryCategory } from "@/components/Entries/types";

export interface EntriesFiltersProps {
  // Names the group for assistive technology ("Filtrar ingresos" / "Filtrar gastos").
  ariaLabel: string;
  // What "settled" is called on this side of the budget: "Cobrado" for incomes, "Pagado" for
  // expenses. The other status is always "Listado".
  settledLabel: string;
  query: EntriesQuery;
  // The select options, or promises of them while they load. The date pickers need only the
  // URL, so they render and work at once; only the two selects wait for these.
  categories: Source<readonly EntryCategory[]>;
  currencies: Source<readonly string[]>;
  // Whether the view differs from the default state. The parent decides because it knows what
  // "default" is (the current month up to today); the bar only shows the button accordingly.
  canClear: boolean;
  onChange: (patch: Partial<EntriesQuery>) => void;
  onClear: () => void;
}

export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterSelectProps {
  label: string;
  allLabel: string;
  options: readonly FilterOption[];
  value: string | null;
  className: string;
  onChange: (value: string | null) => void;
}

export interface FilterSelectSkeletonProps {
  label: string;
  className: string;
}

export interface DateFilterFieldProps {
  label: string;
  // Names the picker's hidden ISO input ("from" / "to").
  name: string;
  value: string | null;
  className: string;
  onCommit: (value: string | null) => void;
}
