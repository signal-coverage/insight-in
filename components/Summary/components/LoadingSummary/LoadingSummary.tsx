import { MetricCard } from "@/components/shared/MetricCard";

import { SUMMARY_ROWS } from "../../consts";
import { CardRow } from "../CardRow";
import { LOADING_LABEL } from "./consts";
import { ROOT_CLASS_NAME } from "./styles";

// The summary while its numbers are on the way: the same rows, titles and tones as the real one,
// each card with a skeleton where its amount will be.
export function LoadingSummary() {
  return (
    <section
      className={ROOT_CLASS_NAME}
      aria-label={LOADING_LABEL}
      aria-busy="true"
    >
      {SUMMARY_ROWS.map((spec) => (
        <CardRow
          key={spec.id}
          label={spec.title}
          title={spec.title}
          Icon={spec.Icon}
          tone={spec.tone}
        >
          {spec.cards.map((card) => (
            <MetricCard
              key={card.id}
              label={card.label}
              description={card.description}
              emphasis={spec.emphasis}
              tone={spec.tone === "balance" ? undefined : spec.tone}
              isLoading
            />
          ))}
        </CardRow>
      ))}
    </section>
  );
}
