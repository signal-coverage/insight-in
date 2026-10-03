import { Chip } from "@heroui/react";
import { useId } from "react";

import {
  HEADING,
  NO_CARDS_MESSAGE,
  RECOMMENDED_LABEL,
  VERDICT_ICONS,
} from "./consts";
import {
  EMPTY_CLASS_NAME,
  HEADING_CLASS_NAME,
  ICON_CLASS_NAME,
  ITEM_CLASS_NAME,
  LIST_CLASS_NAME,
  ROOT_CLASS_NAME,
  TITLE_CLASS_NAME,
  VERDICT_CLASS_NAMES,
} from "./styles";
import type { CardRecommendationsProps } from "./types";

// Which of the user's cards suits the purchase, the best first. Choosing one that does not fit is up
// to the user, so a verdict only informs: it is said in words, with an icon and a colour of its own.
export function CardRecommendations({ items }: CardRecommendationsProps) {
  const headingId = useId();

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby={headingId}>
      <h3 id={headingId} className={HEADING_CLASS_NAME}>
        {HEADING}
      </h3>
      {items.length === 0 ? (
        <p className={EMPTY_CLASS_NAME}>{NO_CARDS_MESSAGE}</p>
      ) : (
        <ul className={LIST_CLASS_NAME} aria-labelledby={headingId}>
          {items.map(
            ({ cardId, title, verdict, verdictLabel, recommended }) => {
              const Icon = VERDICT_ICONS[verdict];

              return (
                <li key={cardId} className={ITEM_CLASS_NAME}>
                  <span className={TITLE_CLASS_NAME}>{title}</span>
                  <Chip
                    size="sm"
                    variant="soft"
                    className={VERDICT_CLASS_NAMES[verdict]}
                  >
                    <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
                    <Chip.Label>{verdictLabel}</Chip.Label>
                  </Chip>
                  {recommended ? (
                    <Chip size="sm" variant="soft">
                      <Chip.Label>{RECOMMENDED_LABEL}</Chip.Label>
                    </Chip>
                  ) : null}
                </li>
              );
            },
          )}
        </ul>
      )}
    </section>
  );
}
