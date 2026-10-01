import { Await } from "@/components/shared/Await";
import { MetricCard } from "@/components/shared/MetricCard";

import { LoadingTotals } from "./components/LoadingTotals";
import { EMPTY_TOTALS, TOTAL_LABEL_PREFIX } from "./consts";
import { LIST_CLASS_NAME } from "./styles";
import type { EntriesTotalsProps } from "./types";

// Three cards per currency (the total, the settled part and the pending part), each with its own
// amount. Totals are never converted or summed across currencies.
export function EntriesTotals({
  totals,
  isLoading = false,
  ariaLabel,
  settledLabel,
  pendingLabel,
}: EntriesTotalsProps) {
  const words = { ariaLabel, settledLabel, pendingLabel };

  if (isLoading) {
    return <LoadingTotals {...words} />;
  }

  return (
    <Await source={totals} fallback={<LoadingTotals {...words} />}>
      {(resolved) => {
        const shown = resolved.length > 0 ? resolved : EMPTY_TOTALS;

        return (
          <ul className={LIST_CLASS_NAME} aria-label={ariaLabel}>
            {shown.flatMap(({ currency, label, settled, pending }) =>
              [
                { prefix: TOTAL_LABEL_PREFIX, value: label },
                { prefix: settledLabel, value: settled },
                { prefix: pendingLabel, value: pending },
              ].map(({ prefix, value }) => (
                <MetricCard
                  key={`${currency}-${prefix}`}
                  label={`${prefix} ${currency}`}
                  value={value}
                />
              )),
            )}
          </ul>
        );
      }}
    </Await>
  );
}
