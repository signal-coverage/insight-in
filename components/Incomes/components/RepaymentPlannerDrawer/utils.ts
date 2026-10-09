import { resolveAccountId } from "@/components/Entries/components/AccountField";
import {
  ACCOUNT_LINE,
  CATEGORY_LINE,
  COUNT_LINE,
  FIRST_LINE,
  LAST_LINE,
  PER_INSTALLMENT_LINE,
  TOTAL_LINE,
} from "@/components/Entries/components/InstallmentTicket/consts";
import type { TicketLine } from "@/components/Entries/types";
import {
  installmentAmountLabel,
  installmentPreviewText,
  splitSummary,
} from "@/components/Entries/utils";
import type { AccountChoice } from "@/core/accounts/types";
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

// What the first step starts with: nothing typed, pesos, no account yet, a year of installments and
// the first one today.
export const initialValues = (defaultDate: string): RepaymentValues => ({
  description: "",
  categoryId: null,
  currency: DEFAULT_CURRENCY_CODE,
  accountId: null,
  amountMode: "total",
  amount: "",
  totalCuotas: DEFAULT_TOTAL_CUOTAS,
  firstDate: defaultDate,
  notes: "",
});

// What the server receives. A piece with no value yet goes as a value the server's rules refuse. The
// account is the one chosen, or the only one of the currency.
export const toPayload = (
  values: RepaymentValues,
  accounts: readonly AccountChoice[] = [],
): IncomeInstallmentPlanPayload => ({
  kind: "income",
  description: values.description,
  categoryId: values.categoryId ?? "",
  currency: values.currency,
  accountId:
    resolveAccountId(accounts, values.currency, values.accountId) ?? "",
  notes: values.notes,
  amount: values.amount,
  amountMode: values.amountMode,
  totalCuotas: values.totalCuotas ?? Number.NaN,
  firstDate: values.firstDate ?? "",
});

// A change of the first step: a currency change drops the account of the old currency.
export const withRepaymentChange = (
  values: RepaymentValues,
  patch: Partial<RepaymentValues>,
): RepaymentValues =>
  patch.currency !== undefined && patch.currency !== values.currency
    ? { ...values, ...patch, accountId: null }
    : { ...values, ...patch };

// The repayment as the server will read it, or null while it is not valid. It is the server's own
// schema, so the button and the live preview agree with what the save will accept.
export const parseRepayment = (
  values: RepaymentValues,
  accounts: readonly AccountChoice[] = [],
): RepaymentSummary | null => {
  const parsed = incomeInstallmentPlanSchema.safeParse(
    toPayload(values, accounts),
  );

  if (!parsed.success) {
    return null;
  }

  const input = parsed.data;

  return {
    input,
    accountLabel:
      accounts.find(({ id }) => id === input.accountId)?.label ?? "",
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
  {
    input,
    installmentAmount,
    isApproximate,
    lastMonth,
    accountLabel,
  }: RepaymentSummary,
  categoryName: string,
): TicketLine[] => [
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
  { label: ACCOUNT_LINE, value: accountLabel },
];
