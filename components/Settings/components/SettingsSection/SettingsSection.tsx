import { Card } from "@heroui/react";

import {
  DESCRIPTION_CLASS_NAME,
  HEADING_CLASS_NAME,
  ROOT_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { SettingsSectionProps } from "./types";

// One heading (and, when it helps, a line under it) and, below, a card with the settings of that
// part of the app.
export function SettingsSection({
  id,
  title,
  description,
  children,
}: SettingsSectionProps) {
  const titleId = `settings-${id}`;

  return (
    <section aria-labelledby={titleId} className={ROOT_CLASS_NAME}>
      <div className={HEADING_CLASS_NAME}>
        <h2 id={titleId} className={TITLE_CLASS_NAME}>
          {title}
        </h2>
        {description ? (
          <p className={DESCRIPTION_CLASS_NAME}>{description}</p>
        ) : null}
      </div>
      <Card>
        <Card.Content>{children}</Card.Content>
      </Card>
    </section>
  );
}
