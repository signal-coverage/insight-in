import type { Source } from "@/components/shared/Await";

import type {
  BlockResult,
  CurrencyChartsRow,
  SummaryRow,
  SummaryView,
} from "../../../../types";

export interface CurrencyPanelsProps {
  // What each panel draws: the figures and the month's charts, or only the 6-month chart.
  view: SummaryView;
  // One per tab, in the tabs' order.
  rows: readonly SummaryRow[];
  // The currencies the user chose to hide from the tabs. The rows keep every currency: the picker lists
  // them all, and only the tabs and their panels leave the hidden ones out.
  hidden: readonly string[];
  charts: Source<BlockResult<readonly CurrencyChartsRow[]>>;
  // The chosen currency (from the address or a press), or null for the default tab.
  selected: string | null;
  onSelect: (currency: string) => void;
  // Where "Reintentar" goes when the charts could not be read.
  retryHref: string;
}
