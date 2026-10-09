import type { CardKind } from "@/core/cards/types";

export interface KindFieldProps {
  value: CardKind;
  onChange: (kind: CardKind) => void;
}

export interface KindOption {
  value: CardKind;
  label: string;
  hint: string;
}
