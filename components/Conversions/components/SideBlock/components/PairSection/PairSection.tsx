import { MetricCard } from "@/components/shared/MetricCard";
import { SIDE_COPY } from "@/components/Conversions/consts";
import { pairCards } from "@/components/Conversions/utils";

import { ConversionsTable } from "./components/ConversionsTable";
import {
  CARDS_CLASS_NAME,
  HEADING_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { PairSectionProps } from "./types";

// Everything one (origin, net) pair did in the month: its figures as cards and each conversion as
// a row. A pair is never added to another one, so each has a section of its own.
export function PairSection({ pair }: PairSectionProps) {
  return (
    <section className={ROOT_CLASS_NAME} aria-label={pair.id}>
      <h3 className={HEADING_CLASS_NAME}>{pair.id}</h3>

      <ul className={CARDS_CLASS_NAME}>
        {pairCards(pair).map((card) => (
          <MetricCard
            key={card.id}
            label={card.label}
            value={card.value}
            description={card.description}
            tone={SIDE_COPY[pair.side].tone}
          />
        ))}
      </ul>

      <ConversionsTable pair={pair} />
    </section>
  );
}
