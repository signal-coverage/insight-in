import { Card } from "@heroui/react";

import { BankBalances } from "./components/BankBalances";
import { cardLabel, TOTAL_LABEL } from "./consts";
import {
  BANKS_CLASS_NAME,
  CURRENCY_CLASS_NAME,
  HEADER_CLASS_NAME,
  NEGATIVE_TOTAL_VALUE_CLASS_NAME,
  ROOT_CLASS_NAME,
  TOTAL_CLASS_NAME,
  TOTAL_VALUE_CLASS_NAME,
} from "./styles";
import type { CurrencyAccountsCardProps } from "./types";

// One currency of the "Por cuenta" section: its total in the header and its banks under it.
export function CurrencyAccountsCard({ row }: CurrencyAccountsCardProps) {
  return (
    <Card
      className={ROOT_CLASS_NAME}
      role="region"
      aria-label={cardLabel(row.currency)}
    >
      <Card.Header className={HEADER_CLASS_NAME}>
        <span className={CURRENCY_CLASS_NAME}>{row.currency}</span>
        <span className={TOTAL_CLASS_NAME}>
          {TOTAL_LABEL}{" "}
          <span
            className={
              row.isTotalNegative
                ? NEGATIVE_TOTAL_VALUE_CLASS_NAME
                : TOTAL_VALUE_CLASS_NAME
            }
          >
            {row.totalLabel}
          </span>
        </span>
      </Card.Header>
      <Card.Content className={BANKS_CLASS_NAME}>
        {row.banks.map((bank) => (
          <BankBalances key={bank.bankId} bank={bank} />
        ))}
      </Card.Content>
    </Card>
  );
}
