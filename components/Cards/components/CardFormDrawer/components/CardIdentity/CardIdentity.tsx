import { KIND_NAMES } from "@/core/cards/consts";

import { BANK_FIELD_NAME } from "../BankField/consts";
import { KIND_FIELD_NAME } from "../KindField/consts";
import { IDENTITY_LABEL, LOCKED_HINT, identityText } from "./consts";
import {
  ERROR_CLASS_NAME,
  HINT_CLASS_NAME,
  LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  VALUE_CLASS_NAME,
} from "./styles";
import type { CardIdentityProps } from "./types";

// The kind and the bank of a card being edited: shown, never chosen again, and sent back as they are
// (the server refuses a change).
export function CardIdentity({
  kind,
  bankId,
  bankName,
  errorMessage,
}: CardIdentityProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <p className={LABEL_CLASS_NAME}>{IDENTITY_LABEL}</p>
      <p className={VALUE_CLASS_NAME}>
        {identityText(KIND_NAMES[kind], bankName)}
      </p>
      <p className={HINT_CLASS_NAME}>{LOCKED_HINT}</p>
      {errorMessage ? (
        <p role="alert" className={ERROR_CLASS_NAME}>
          {errorMessage}
        </p>
      ) : null}
      <input type="hidden" name={KIND_FIELD_NAME} value={kind} />
      <input type="hidden" name={BANK_FIELD_NAME} value={bankId} />
    </div>
  );
}
