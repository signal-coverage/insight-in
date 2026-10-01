import { MetricCard } from "@/components/shared/MetricCard";

import { SUMMARY_ROWS } from "../../consts";
import { CardRow } from "../CardRow";
import { HEADING_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { CurrencySectionProps } from "./types";
import { rowLabel, sectionLabel, valueFor } from "./utils";

// Everything about one currency in the month: incomes, expenses, and the two remainders they leave.
// Currencies are never added together, so each one has a section of its own.
export function CurrencySection({ row }: CurrencySectionProps) {
  const { currency } = row;

  return (
    <section className={ROOT_CLASS_NAME} aria-label={sectionLabel(currency)}>
      <h2 className={HEADING_CLASS_NAME}>{currency}</h2>

      {SUMMARY_ROWS.map((spec) => (
        <CardRow
          key={spec.id}
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
              emphasis={spec.emphasis}
              tone={spec.tone === "balance" ? undefined : spec.tone}
            />
          ))}
        </CardRow>
      ))}
    </section>
  );
}
