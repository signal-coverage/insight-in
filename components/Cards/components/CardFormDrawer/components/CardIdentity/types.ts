import type { CardKind } from "@/core/cards/types";

export interface CardIdentityProps {
  kind: CardKind;
  bankId: string;
  bankName: string;
  // What the server said about the kind or the bank (only a forged request can change them).
  errorMessage?: string;
}
