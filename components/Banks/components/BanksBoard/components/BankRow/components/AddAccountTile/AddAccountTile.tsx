import { ADD_ACCOUNT_TEXT, addAccountLabel } from "./consts";
import { ADD_TILE_CLASS_NAME } from "./styles";
import type { AddAccountTileProps } from "./types";

// The last tile of an active bank's row: it starts a new account in that bank.
export function AddAccountTile({
  bankId,
  bankName,
  onAdd,
}: AddAccountTileProps) {
  return (
    <button
      type="button"
      className={ADD_TILE_CLASS_NAME}
      aria-label={addAccountLabel(bankName)}
      onClick={() => onAdd(bankId)}
    >
      {ADD_ACCOUNT_TEXT}
    </button>
  );
}
