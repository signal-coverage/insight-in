// One account of the opening balance editor. `index` is its position among all the rows: the input
// is named by it, which is how the server points at the one in error. `amount` is decimal text
// ("1500.50") ready to prefill the input, or "" when there is none saved.
export interface OpeningAccountRow {
  index: number;
  accountId: string;
  currency: string;
  // "Caja de ahorro (ARS)", with "· archivada" for an archived account.
  label: string;
  amount: string;
}

// The accounts of one bank, as one group of the editor.
export interface OpeningBankGroup {
  bankId: string;
  bankName: string;
  rows: OpeningAccountRow[];
}

// What the editor starts from: the month the saved opening balance is valid from (null when there
// is none) and the accounts it offers, grouped by bank.
export interface OpeningBalanceData {
  month: string | null;
  groups: OpeningBankGroup[];
}

// What "Guardar" sends to the server, amounts exactly as typed, one row per account.
export interface OpeningBalancePayload {
  month: string;
  balances: { accountId: string; currency: string; amount: string }[];
}

export interface MonthOption {
  value: string;
  label: string;
}

export interface OpeningBalanceDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // The month in course, where the chooser ends and what it starts on without a saved balance.
  currentMonth: string;
  data: OpeningBalanceData;
  // Changes on every opening, so each one starts from the saved values and with no errors.
  sessionKey: number;
}

export type OpeningBalanceContentProps = Pick<
  OpeningBalanceDrawerProps,
  "onClose" | "currentMonth" | "data"
>;

export interface BankFieldsProps {
  group: OpeningBankGroup;
}
