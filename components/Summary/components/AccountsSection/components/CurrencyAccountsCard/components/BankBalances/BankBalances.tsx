import { ARCHIVED_SUFFIX } from "./consts";
import {
  BALANCE_CLASS_NAME,
  BANK_CLASS_NAME,
  LIST_CLASS_NAME,
  NAME_CLASS_NAME,
  NEGATIVE_BALANCE_CLASS_NAME,
  ROOT_CLASS_NAME,
  ROW_CLASS_NAME,
} from "./styles";
import type { BankBalancesProps } from "./types";

// A bank and the accounts it holds in the card's currency, each with its balance.
export function BankBalances({ bank }: BankBalancesProps) {
  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-label={bank.bankName}>
      <span className={BANK_CLASS_NAME} aria-hidden="true">
        {bank.bankName}
      </span>
      <ul className={LIST_CLASS_NAME}>
        {bank.accounts.map((account) => (
          <li key={account.accountId} className={ROW_CLASS_NAME}>
            <span
              className={NAME_CLASS_NAME}
              title={
                account.isArchived
                  ? `${account.name}${ARCHIVED_SUFFIX}`
                  : account.name
              }
            >
              {account.isArchived
                ? `${account.name}${ARCHIVED_SUFFIX}`
                : account.name}
            </span>
            <span
              className={
                account.isNegative
                  ? NEGATIVE_BALANCE_CLASS_NAME
                  : BALANCE_CLASS_NAME
              }
            >
              {account.balanceLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
