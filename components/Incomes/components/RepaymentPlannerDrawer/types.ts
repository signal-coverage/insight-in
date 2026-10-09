import type { EntryCategory } from "@/components/Entries/types";
import type { AccountChoice } from "@/core/accounts/types";
import type {
  AmountMode,
  IncomeInstallmentPlanInput,
} from "@/core/installments/types";

export interface RepaymentPlannerDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Remounts the planner on every opening, so each one starts from fresh defaults.
  sessionKey: number;
  // The Argentine calendar date at opening: where the date of the first installment starts.
  defaultDate: string;
  // The user's income categories.
  categories: readonly EntryCategory[];
  // Every account of the user (archived ones included): the form offers the ones of the currency.
  accounts: readonly AccountChoice[];
}

export type RepaymentPlannerContentProps = Pick<
  RepaymentPlannerDrawerProps,
  "onClose" | "defaultDate" | "categories" | "accounts"
>;

// The steps: the data of the repayment, then the ticket to review before saving.
export type RepaymentStep = "repayment" | "review";

// What the first step holds while the user fills it in. The amount stays as typed; the pieces that
// have no value yet are null.
export interface RepaymentValues {
  // What is being repaid ("Préstamo a Juan").
  description: string;
  categoryId: string | null;
  currency: string;
  // The account the money arrives in, or null while none is chosen (see resolveAccountId).
  accountId: string | null;
  amountMode: AmountMode;
  amount: string;
  totalCuotas: number | null;
  // The date the user types for the first installment.
  firstDate: string | null;
  notes: string;
}

// A valid repayment, with the split worked out.
export interface RepaymentSummary {
  input: IncomeInstallmentPlanInput;
  // What the first installment brings (minor units): the one shown as "the" amount per installment.
  installmentAmount: number;
  // The total does not divide evenly, so the amount above is only close to what each one brings.
  isApproximate: boolean;
  // "Banco · Cuenta" of the account.
  accountLabel: string;
  // "YYYY-MM" of the last installment.
  lastMonth: string;
}
