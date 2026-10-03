// One currency of the opening balance editor, its two amounts as decimal text ("1500.50") ready to
// prefill an input, or "" when there is no amount saved.
export interface OpeningBalanceRow {
  currency: string;
  digital: string;
  cash: string;
}

// What the editor starts from: the month the saved opening balance is valid from (null when there
// is none) and a row for every currency it offers.
export interface OpeningBalanceData {
  month: string | null;
  rows: OpeningBalanceRow[];
}

// What "Guardar" sends to the server, amounts exactly as typed.
export interface OpeningBalancePayload {
  month: string;
  balances: OpeningBalanceRow[];
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

export interface CurrencyFieldsProps {
  row: OpeningBalanceRow;
  // Position of the row in the editor: the server reports its errors by it.
  index: number;
}
