import { Card } from "@heroui/react";

import { LegendEntry } from "../LegendEntry";
import { LIST_CLASS_NAME, ROOT_CLASS_NAME, TITLE_CLASS_NAME } from "./styles";
import type { LegendGroupProps } from "./types";

// One heading and, under it, a card with everything that belongs to it.
export function LegendGroup({ group }: LegendGroupProps) {
  const titleId = `legend-${group.id}`;

  return (
    <section aria-labelledby={titleId} className={ROOT_CLASS_NAME}>
      <h2 id={titleId} className={TITLE_CLASS_NAME}>
        {group.title}
      </h2>
      <Card>
        <Card.Content>
          <ul className={LIST_CLASS_NAME}>
            {group.entries.map((entry) => (
              <LegendEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        </Card.Content>
      </Card>
    </section>
  );
}
