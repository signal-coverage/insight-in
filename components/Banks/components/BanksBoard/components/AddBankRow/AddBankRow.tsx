import { ADD_BANK_TEXT } from "./consts";
import {
  ADD_BANK_CLASS_NAME,
  FRAME_CLASS_NAME,
  ROW_CLASS_NAME,
} from "./styles";
import type { AddBankRowProps } from "./types";

// The closing row of the board: it starts a new bank, the same as "Crear banco" in the Actions menu.
export function AddBankRow({ onAdd }: AddBankRowProps) {
  return (
    <li className={ROW_CLASS_NAME}>
      <div className={FRAME_CLASS_NAME}>
        <button type="button" className={ADD_BANK_CLASS_NAME} onClick={onAdd}>
          {ADD_BANK_TEXT}
        </button>
      </div>
    </li>
  );
}
