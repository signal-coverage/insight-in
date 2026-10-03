import { originRate } from "@/components/Entries/utils";

import type { RecurringRow } from "../../../../../../types";

// "1 USD = $ 1.750,00": what one unit of the template's reference currency costs at the amount typed
// in the wizard (the template's reference amount stays as it is). Null without a reference price, and
// while the typed amount is not valid.
export const referenceRate = (
  row: RecurringRow,
  value: string,
): string | null =>
  row.originCurrency === null || row.originAmountDecimal === null
    ? null
    : originRate({
        netAmount: value,
        netCurrency: row.currency,
        originAmount: row.originAmountDecimal,
        originCurrency: row.originCurrency,
      });
