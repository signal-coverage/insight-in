import { ProgressBar } from "@heroui/react";

import { MetricCard } from "@/components/shared/MetricCard";

import { SUMMARY_ROWS } from "../../consts";
import { CardRow } from "../CardRow";
import { paidLabel, paidText } from "./consts";
import {
  COLUMN_CLASS_NAME,
  COLUMNS_CLASS_NAME,
  HEADING_CLASS_NAME,
  PAID_BAR_CLASS_NAME,
  PAID_CLASS_NAME,
  PAID_TEXT_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { CurrencySectionProps } from "./types";
import { rowLabel, sectionLabel, valueFor } from "./utils";

// Everything about one currency in the month, in three columns: incomes, expenses (with how much of
// them is paid) and the remainders they leave. Currencies are never added together, so each one has a
// section of its own.
export function CurrencySection({ row }: CurrencySectionProps) {
  const { currency } = row;

  return (
    <section className={ROOT_CLASS_NAME} aria-label={sectionLabel(currency)}>
      <h3 className={HEADING_CLASS_NAME}>{currency}</h3>

      <div className={COLUMNS_CLASS_NAME}>
        {SUMMARY_ROWS.map((spec) => (
          <div
            key={spec.id}
            className={COLUMN_CLASS_NAME}
            data-column={spec.id}
          >
            <CardRow
              label={rowLabel(spec.title, currency)}
              title={spec.title}
              Icon={spec.Icon}
              tone={spec.tone}
            >
              {spec.cards.map((card) => (
                <MetricCard
                  key={card.id}
                  label={card.label}
                  value={valueFor(row, spec, card)}
                  description={card.description}
                  emphasis={card.emphasis ?? spec.emphasis}
                  tone={spec.tone === "balance" ? undefined : spec.tone}
                />
              ))}
            </CardRow>
            {spec.id === "expenses" ? (
              <div className={PAID_CLASS_NAME}>
                <ProgressBar
                  aria-label={paidLabel(currency)}
                  size="sm"
                  value={row.paidPercent}
                  className={PAID_BAR_CLASS_NAME}
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                <span className={PAID_TEXT_CLASS_NAME}>
                  {paidText(row.paidPercent)}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
