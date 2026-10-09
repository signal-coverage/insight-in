import type { BankKind } from "@/core/banks/types";

export interface KindFieldProps {
  // The kind the radio group starts on: the bank's own on an edit, an entity for a new bank.
  defaultValue: BankKind;
}

export interface KindOption {
  value: BankKind;
  label: string;
  hint: string;
}
