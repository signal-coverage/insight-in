import {
  DEBIT_ACCOUNT_HINT,
  DEBIT_ACCOUNT_LABEL,
  debitAccountText,
} from "./consts";
import {
  ERROR_CLASS_NAME,
  HINT_CLASS_NAME,
  LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  VALUE_CLASS_NAME,
} from "./styles";
import type { DebitAccountLineProps } from "./types";

// Where a debit card's expense takes its money from. The server decides it from the card's bank and the
// currency, so the form shows it and sends none.
export function DebitAccountLine({
  label,
  errorMessage,
}: DebitAccountLineProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <p className={LABEL_CLASS_NAME}>{DEBIT_ACCOUNT_LABEL}</p>
      <p className={VALUE_CLASS_NAME}>{debitAccountText(label)}</p>
      <p className={HINT_CLASS_NAME}>{DEBIT_ACCOUNT_HINT}</p>
      {errorMessage ? (
        <p role="alert" className={ERROR_CLASS_NAME}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
