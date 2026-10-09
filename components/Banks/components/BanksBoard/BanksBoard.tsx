import { BOARD_CLASS_NAME, EMPTY_CLASS_NAME } from "@/components/Banks/styles";

import { AddBankRow } from "./components/AddBankRow";
import { BankRow } from "./components/BankRow";
import { BOARD_LABEL } from "./consts";
import { emptyMessage } from "./utils";
import type { BanksBoardProps } from "./types";

// A table-style board in one bordered container: one row per bank, the bank in the first column and
// the rest of the row holding one card per account, and a "+ Nuevo banco" row at the end. It is not a
// <table>: the rows scroll sideways together on a narrow screen. The container is the list itself, so it exists only when
// there are rows (the empty states below stay outside any box).
export function BanksBoard({
  banks,
  isSearching,
  hasArchivedBanks,
  onEditBank,
  onEditAccount,
  onAddAccount,
  onAddBank,
}: BanksBoardProps) {
  if (banks.length === 0) {
    return (
      <p role="status" className={EMPTY_CLASS_NAME}>
        {emptyMessage(isSearching, hasArchivedBanks)}
      </p>
    );
  }

  return (
    <ul className={BOARD_CLASS_NAME} aria-label={BOARD_LABEL}>
      {banks.map((bank) => (
        <BankRow
          key={bank.id}
          bank={bank}
          onEditBank={onEditBank}
          onEditAccount={onEditAccount}
          onAddAccount={onAddAccount}
        />
      ))}
      <AddBankRow onAdd={onAddBank} />
    </ul>
  );
}
