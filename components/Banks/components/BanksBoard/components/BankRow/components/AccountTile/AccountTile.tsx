import { Chip } from "@heroui/react";

import { ARCHIVED_ACCOUNT_LABEL, editAccountLabel } from "./consts";
import {
  ARCHIVED_TILE_CLASS_NAME,
  BALANCE_CLASS_NAME,
  CURRENCY_CLASS_NAME,
  META_CLASS_NAME,
  NAME_CLASS_NAME,
  NEGATIVE_BALANCE_CLASS_NAME,
  TILE_CLASS_NAME,
} from "./styles";
import type { AccountTileProps } from "./types";

// One account of a bank: its name at the top-left, its balance under it (red when negative) and its
// currency at the bottom-right (the archived chip at the bottom-left). Pressing it opens the editor.
export function AccountTile({ account, onEdit }: AccountTileProps) {
  return (
    <button
      type="button"
      className={account.archived ? ARCHIVED_TILE_CLASS_NAME : TILE_CLASS_NAME}
      aria-label={editAccountLabel(account)}
      onClick={() => onEdit(account)}
    >
      <span className={NAME_CLASS_NAME}>{account.name}</span>
      <span
        className={
          account.balance < 0 ? NEGATIVE_BALANCE_CLASS_NAME : BALANCE_CLASS_NAME
        }
      >
        {account.balanceLabel}
      </span>
      <span className={META_CLASS_NAME}>
        {account.archived ? (
          <Chip size="sm" variant="soft">
            {ARCHIVED_ACCOUNT_LABEL}
          </Chip>
        ) : null}
        <span className={CURRENCY_CLASS_NAME}>
          <Chip size="sm" variant="soft">
            {account.currency}
          </Chip>
        </span>
      </span>
    </button>
  );
}
