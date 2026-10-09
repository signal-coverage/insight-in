export interface AddAccountTileProps {
  bankId: string;
  bankName: string;
  // Starts a new account in this bank.
  onAdd: (bankId: string) => void;
}
