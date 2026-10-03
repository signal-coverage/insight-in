import type { EntryCategory } from "@/components/Entries/types";
import type { CardVerdict } from "@/core/cards/types";
import type { PaymentMedium } from "@/core/entries/medium";
import type {
  AmountMode,
  CardOwnership,
  InstallmentPlanInput,
} from "@/core/installments/types";

import type { CardOption } from "../../types";

export interface InstallmentPlannerDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Remounts the planner on every opening, so each one starts from fresh defaults.
  sessionKey: number;
  // The Argentine calendar date at opening: where the date of the first installment starts, and
  // which month counts as "this month".
  defaultDate: string;
  categories: readonly EntryCategory[];
  // The user's cards, to pay the purchase with one of them and to see which one suits it.
  cards: readonly CardOption[];
}

export type InstallmentPlannerContentProps = Pick<
  InstallmentPlannerDrawerProps,
  "onClose" | "defaultDate" | "categories" | "cards"
>;

// The steps: the data of the purchase, then the ticket to review before saving. When an own card
// charges the first installment this very month, saving asks first in a pop-up over the ticket.
export type PlannerStep = "purchase" | "review";

// What the first step holds while the user fills it in. The amount stays as typed; the pieces that
// have no value yet are null.
export interface PurchaseValues {
  description: string;
  categoryId: string | null;
  currency: string;
  medium: PaymentMedium;
  amountMode: AmountMode;
  amount: string;
  totalCuotas: number | null;
  // With a borrowed card, the date the user types for the first installment.
  firstDate: string | null;
  // Whose card pays the purchase: one of the user's own, or one borrowed from somebody else.
  cardOwnership: CardOwnership;
  // The own card chosen, if any (a borrowed card has no record). With an own card, the date of the
  // purchase takes the place of the first installment's date: the card's cycle works that one out.
  cardId: string | null;
  purchaseDate: string | null;
  notes: string;
}

// A valid purchase, with the split worked out.
export interface PurchaseSummary {
  input: InstallmentPlanInput;
  // The own card chosen, or null for a borrowed card.
  card: CardOption | null;
  ownership: CardOwnership;
  // What the first installment costs (minor units): the one shown as "the" amount per installment.
  installmentAmount: number;
  // The total does not divide evenly, so the real charge of each installment depends on the bank and
  // the amount above is only close to it.
  isApproximate: boolean;
  // "YYYY-MM" of the last installment.
  lastMonth: string;
}

// How one card suits the purchase, ready to show.
export interface CardRecommendationItem {
  cardId: string;
  // "Visa •••• 1234".
  title: string;
  verdict: CardVerdict;
  // "Entra en el tope (te queda $ 70.000,00)", "Cerca del tope" or "Se pasa del tope por $ 1,00".
  verdictLabel: string;
  recommended: boolean;
}
