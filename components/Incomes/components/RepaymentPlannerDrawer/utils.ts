import {
  CATEGORY_LINE,
  COUNT_LINE,
  FIRST_LINE,
  LAST_LINE,
  MEDIUM_LINE,
  PER_INSTALLMENT_LINE,
  TOTAL_LINE,
} from "@/components/Entries/components/InstallmentTicket/consts";
import { MEDIUM_OPTIONS } from "@/components/Entries/components/MediumField/consts";
import type { TicketLine } from "@/components/Entries/types";
import {
  installmentAmountLabel,
  installmentPreviewText,
  splitSummary,
} from "@/components/Entries/utils";
import { DEFAULT_PAYMENT_MEDIUM } from "@/core/entries/medium";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";
import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney } from "@/core/incomes/money";
import { DEFAULT_TOTAL_CUOTAS } from "@/core/installments/consts";
import { lastInstallmentMonth } from "@/core/installments/plan";
import { incomeInstallmentPlanSchema } from "@/core/installments/schema";
import type { IncomeInstallmentPlanPayload } from "@/core/installments/types";
import { formatMonth } from "@/core/summary/month";

import { CONCEPT_LINE } from "./consts";
import type { RepaymentSummary, RepaymentValues } from "./types";

// What the first step starts with: nothing typed, pesos, digital, a year of installments and the
// first one today.
export const initialValues = (defaultDate: string): RepaymentValues => ({
  description: "",
  categoryId: null,
  currency: DEFAULT_CURRENCY_CODE,
  medium: DEFAULT_PAYMENT_MEDIUM,
  amountMode: "total",
  amount: "",
  totalCuotas: DEFAULT_TOTAL_CUOTAS,
  firstDate: defaultDate,
  notes: "",
});

// What the server receives. A piece with no value yet goes as a value the server's rules refuse.
export const toPayload = (
  values: RepaymentValues,
): IncomeInstallmentPlanPayload => ({
  kind: "income",
  description: values.description,
  categoryId: values.categoryId ?? "",
  currency: values.currency,
  medium: values.medium,
  notes: values.notes,
  amount: values.amount,
  amountMode: values.amountMode,
  totalCuotas: values.totalCuotas ?? Number.NaN,
  firstDate: values.firstDate ?? "",
});

// The repayment as the server will read it, or null while it is not valid. It is the server's own
// schema, so the button and the live preview agree with what the save will accept.
export const parseRepayment = (
  values: RepaymentValues,
): RepaymentSummary | null => {
  const parsed = incomeInstallmentPlanSchema.safeParse(toPayload(values));

  if (!parsed.success) {
    return null;
  }

  const input = parsed.data;

  return {
    input,
    ...splitSummary(input.totalAmount, input.totalCuotas),
    lastMonth: lastInstallmentMonth(input.firstDate, input.totalCuotas),
  };
};

// "12 cuotas de $ 100.000,00 · total $ 1.200.000,00", with "≈" before the installment's amount when
// the total does not divide evenly.
export const previewText = ({
  input,
  installmentAmount,
  isApproximate,
}: RepaymentSummary): string =>
  installmentPreviewText({
    totalCuotas: input.totalCuotas,
    installmentAmount,
    isApproximate,
    totalAmount: input.totalAmount,
    currency: input.currency,
  });

// The lines of the ticket, in the order a receipt would list them.
export const toTicketLines = (
  { input, installmentAmount, isApproximate, lastMonth }: RepaymentSummary,
  categoryName: string,
): TicketLine[] => {
  const medium = MEDIUM_OPTIONS.find(({ value }) => value === input.medium);

  return [
    { label: CONCEPT_LINE, value: input.description },
    { label: CATEGORY_LINE, value: categoryName },
    { label: COUNT_LINE, value: String(input.totalCuotas) },
    {
      label: PER_INSTALLMENT_LINE,
      value: installmentAmountLabel(
        installmentAmount,
        input.currency,
        isApproximate,
      ),
    },
    {
      label: TOTAL_LINE,
      value: formatMoney(input.totalAmount, input.currency),
    },
    { label: FIRST_LINE, value: formatIncomeDate(input.firstDate) },
    { label: LAST_LINE, value: formatMonth(lastMonth) },
    { label: MEDIUM_LINE, value: medium?.label ?? input.medium },
  ];
};
