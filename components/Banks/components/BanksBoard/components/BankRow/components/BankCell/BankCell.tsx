import { Chip } from "@heroui/react";

import {
  ARCHIVED_BANK_LABEL,
  editBankLabel,
  WALLET_BANK_LABEL,
} from "./consts";
import {
  ARCHIVED_NAME_CLASS_NAME,
  CELL_CLASS_NAME,
  CHIPS_CLASS_NAME,
  COLUMN_CLASS_NAME,
  NAME_CLASS_NAME,
} from "./styles";
import type { BankCellProps } from "./types";

// The first column of a row: the sticky column holding the bank as a card, with a "Billetera" chip
// for a virtual wallet and an "Archivado" one for an archived bank. Pressing the card opens the
// editor of the bank.
export function BankCell({ bank, onEdit }: BankCellProps) {
  return (
    <div className={COLUMN_CLASS_NAME}>
      <button
        type="button"
        className={CELL_CLASS_NAME}
        aria-label={editBankLabel(bank)}
        onClick={() => onEdit(bank.id)}
      >
        <span
          className={bank.archived ? ARCHIVED_NAME_CLASS_NAME : NAME_CLASS_NAME}
        >
          {bank.name}
        </span>
        {bank.kind === "WALLET" || bank.archived ? (
          <span className={CHIPS_CLASS_NAME}>
            {bank.kind === "WALLET" ? (
              <Chip size="sm" variant="soft">
                {WALLET_BANK_LABEL}
              </Chip>
            ) : null}
            {bank.archived ? (
              <Chip size="sm" variant="soft">
                {ARCHIVED_BANK_LABEL}
              </Chip>
            ) : null}
          </span>
        ) : null}
      </button>
    </div>
  );
}
