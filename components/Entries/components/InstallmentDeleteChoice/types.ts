import type { DeleteScope, PlanSide } from "@/components/Entries/types";
import type { PlanProgress } from "@/core/installments/types";

export interface InstallmentDeleteChoiceProps {
  // Whether the plan is a purchase paid in cuotas or a loan repaid to the user: it decides whether the
  // cuotas are "pagadas" or "cobradas".
  side: PlanSide;
  progress: PlanProgress;
  scope: DeleteScope;
  onScopeChange: (scope: DeleteScope) => void;
  // The explicit acknowledgement that the whole plan goes away. Only asked for when the plan is chosen.
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  isDisabled: boolean;
}
