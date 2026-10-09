import { Card } from "@heroui/react";

import { AttentionGroup } from "./components/AttentionGroup";
import { HEADING_ID, SECTION_TITLE } from "./consts";
import {
  CARD_CLASS_NAME,
  GROUPS_CLASS_NAME,
  HEADING_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AttentionSectionProps } from "./types";

// What needs the user's attention today (and the next days), the most urgent kind first. It is not
// rendered at all when nothing applies.
export function AttentionSection({ groups }: AttentionSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
        {SECTION_TITLE}
      </h2>
      <Card className={CARD_CLASS_NAME}>
        <Card.Content className={GROUPS_CLASS_NAME}>
          {groups.map((group) => (
            <AttentionGroup key={group.kind} group={group} />
          ))}
        </Card.Content>
      </Card>
    </section>
  );
}
