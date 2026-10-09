import { ROW_CLASS_NAME } from "@/components/Banks/styles";

import { AccountTile } from "./components/AccountTile";
import { AddAccountTile } from "./components/AddAccountTile";
import { BankCell } from "./components/BankCell";
import { accountsLabel } from "./consts";
import { TILE_ITEM_CLASS_NAME, TILES_CLASS_NAME } from "./styles";
import type { BankRowProps } from "./types";

// One row of the board: the bank in the first column, then one card per account and, unless the
// bank is archived, the "+ Nueva cuenta" card.
export function BankRow({
  bank,
  onEditBank,
  onEditAccount,
  onAddAccount,
}: BankRowProps) {
  return (
    <li className={ROW_CLASS_NAME}>
      <BankCell bank={bank} onEdit={onEditBank} />
      <ul className={TILES_CLASS_NAME} aria-label={accountsLabel(bank.name)}>
        {bank.accounts.map((account) => (
          <li key={account.id} className={TILE_ITEM_CLASS_NAME}>
            <AccountTile account={account} onEdit={onEditAccount} />
          </li>
        ))}
        {bank.archived ? null : (
          <li className={TILE_ITEM_CLASS_NAME}>
            <AddAccountTile
              bankId={bank.id}
              bankName={bank.name}
              onAdd={onAddAccount}
            />
          </li>
        )}
      </ul>
    </li>
  );
}
