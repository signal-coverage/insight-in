export interface DebitAccountLineProps {
  // "Banco · Cuenta" of the account the expense takes its money from.
  label: string;
  // What the server said about the account (an archived one on a new template).
  errorMessage?: string;
}
