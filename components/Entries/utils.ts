import {
  formatOrigin,
  formatOriginLabel,
  formatRate,
  formatRateMoney,
  impliedRate,
  isOriginCurrencyCode,
  toOriginDecimalString,
  toOriginMinorUnits,
} from "@/core/currencies/origin";
import type { CurrencyTotal } from "@/core/entries/types";
import { formatMoney, toMinorUnits } from "@/core/incomes/money";
import type {
  InstallmentCountInput,
  InstallmentPlanItem,
  PlanProgress,
} from "@/core/installments/types";

import { splitAmount } from "@/core/installments/plan";

import {
  APPROXIMATE_PREFIX,
  RATE_PREFIX,
  installmentProgressLabel,
} from "./consts";
import type {
  InstallmentCounts,
  InstallmentPlanRow,
  OriginRateInput,
  OriginSource,
  OriginStrings,
  TotalRow,
} from "./types";

// Totals arrive already summed per currency by the database, over the whole filtered set.
export const toTotalRows = (totals: readonly CurrencyTotal[]): TotalRow[] =>
  totals.map(({ currency, total, settled }) => ({
    currency,
    label: formatMoney(total, currency),
    settled: formatMoney(settled, currency),
    pending: formatMoney(total - settled, currency),
  }));

const NO_ORIGIN_STRINGS: OriginStrings = {
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
};

// The strings of an entry origin: the plain decimal for the form, the short text of the marker and
// the tooltip with the exact amount and the rate that net / origin implies. `prefix` is what the
// entry says ("Viene de" for an income, "Se cotizó en" for an expense).
export const toOriginStrings = (
  { amount, currency, originCurrency, originAmount }: OriginSource,
  prefix: string,
): OriginStrings => {
  if (originCurrency === null || originAmount === null) {
    return NO_ORIGIN_STRINGS;
  }

  const rate = impliedRate(amount, currency, originAmount, originCurrency);
  const from = `${prefix} ${formatOrigin(originAmount, originCurrency)}`;

  return {
    originAmountDecimal: toOriginDecimalString(originAmount, originCurrency),
    originLabel: `${prefix} ${formatOriginLabel(originAmount, originCurrency)}`,
    originTooltip:
      rate === null ? from : `${from} · ${RATE_PREFIX} ${formatRate(rate)}`,
  };
};

// "1 USD = $ 1.750,00": what one unit of the origin cost in the net currency, while both amounts are
// valid; null otherwise.
export const originRate = ({
  netAmount,
  netCurrency,
  originAmount,
  originCurrency,
}: OriginRateInput): string | null => {
  if (
    originCurrency === null ||
    !isOriginCurrencyCode(originCurrency, netCurrency)
  ) {
    return null;
  }

  const net = toMinorUnits(netAmount, netCurrency);
  const origin = toOriginMinorUnits(originAmount, originCurrency);

  if (net === null || origin === null) {
    return null;
  }

  const rate = impliedRate(net, netCurrency, origin, originCurrency);

  return rate === null
    ? null
    : `1 ${originCurrency} = ${formatRateMoney(rate, netCurrency)}`;
};

// A plan in installments with the strings its monthly list shows, formatted on the server like the
// rows of the tables.
export const toInstallmentPlanRow = (
  plan: InstallmentPlanItem,
): InstallmentPlanRow => ({
  ...plan,
  nextAmountLabel: formatMoney(plan.nextAmount, plan.currency),
  progressLabel: installmentProgressLabel(
    plan.doneCount,
    plan.totalCuotas,
    plan.pendingCount,
  ),
});

// How a total splits into installments, for the live line and the ticket. The first installment is the
// largest when the total does not divide evenly. The bank (or whoever pays) decides what each one
// really is, so that is the amount shown, as an approximation.
export const splitSummary = (
  totalAmount: number,
  totalCuotas: number,
): { installmentAmount: number; isApproximate: boolean } => {
  const [installmentAmount] = splitAmount(totalAmount, totalCuotas);

  return {
    installmentAmount,
    isApproximate: totalAmount % totalCuotas !== 0,
  };
};

// "$ 100.000,00", or "≈ $ 33.333,34" when the total does not divide evenly.
export const installmentAmountLabel = (
  amount: number,
  currency: string,
  isApproximate: boolean,
): string => {
  const text = formatMoney(amount, currency);

  return isApproximate ? `${APPROXIMATE_PREFIX} ${text}` : text;
};

// "12 cuotas de $ 100.000,00 · total $ 1.200.000,00", with "≈" before the installment's amount when
// the total does not divide evenly.
export const installmentPreviewText = ({
  totalCuotas,
  installmentAmount,
  isApproximate,
  totalAmount,
  currency,
}: {
  totalCuotas: number;
  installmentAmount: number;
  isApproximate: boolean;
  totalAmount: number;
  currency: string;
}): string =>
  `${totalCuotas} cuotas de ${installmentAmountLabel(installmentAmount, currency, isApproximate)} · total ${formatMoney(totalAmount, currency)}`;

// The message to show when the save of a plan is refused: the first field error the server found, or
// its general message.
export const firstError = (result: {
  message: string;
  fieldErrors?: Record<string, string[]>;
}): string =>
  Object.values(result.fieldErrors ?? {}).flat()[0] ?? result.message;

// What "Aplicar" sends for the plans in installments: one entry per plan whose count the user
// changed from the default, in the order of the plans. The ones left alone send nothing.
export const toInstallmentCounts = (
  plans: readonly InstallmentPlanRow[],
  counts: InstallmentCounts,
): InstallmentCountInput[] =>
  plans.flatMap((plan): InstallmentCountInput[] => {
    const count = counts[plan.id];

    return count === undefined || count === plan.defaultCount
      ? []
      : [{ planId: plan.id, count }];
  });

// The progress of the plan an entry belongs to, as the field to spread into its row: nothing when the
// entry is no installment or its plan is not among the known ones.
export const toPlanProgressField = (
  planId: string | null,
  planProgress: Readonly<Record<string, PlanProgress>>,
): { planProgress?: PlanProgress } => {
  const progress = planId === null ? undefined : planProgress[planId];

  return progress ? { planProgress: progress } : {};
};

// The rows a delete is working on once the plans being deleted are counted: those ids plus every row
// of a plan on its way out. With no plan being deleted it is the same set it was given.
export const withPlanRows = (
  deletingIds: ReadonlySet<string>,
  deletingPlanIds: ReadonlySet<string>,
  rows: readonly { id: string; installmentPlanId: string | null }[],
): ReadonlySet<string> => {
  if (deletingPlanIds.size === 0) {
    return deletingIds;
  }

  return new Set([
    ...deletingIds,
    ...rows
      .filter(
        ({ installmentPlanId }) =>
          installmentPlanId !== null && deletingPlanIds.has(installmentPlanId),
      )
      .map(({ id }) => id),
  ]);
};
