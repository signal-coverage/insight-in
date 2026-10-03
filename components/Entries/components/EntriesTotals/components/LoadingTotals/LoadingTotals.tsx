import { MetricCard } from "@/components/shared/MetricCard";

import { TOTAL_LABEL_PREFIX } from "../../consts";
import { LIST_CLASS_NAME } from "../../styles";
import type { LoadingTotalsProps } from "./types";

// Same cards as the real ones, with a skeleton where each amount will be. It deliberately shows no
// zero and no currency: either would read as a real result before the data arrives.
export function LoadingTotals({
  ariaLabel,
  settledLabel,
  pendingLabel,
}: LoadingTotalsProps) {
  return (
    <ul className={LIST_CLASS_NAME} aria-label={ariaLabel} aria-busy="true">
      {[TOTAL_LABEL_PREFIX, settledLabel, pendingLabel].map((label) => (
        <MetricCard key={label} label={label} isLoading />
      ))}
    </ul>
  );
}
