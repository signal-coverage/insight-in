import { cn } from "@/lib/utils/utils";

import {
  DESCRIPTION_CLASS_NAME,
  ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
  TITLE_CLASS_NAME,
  TONE_CLASS_NAMES,
} from "./styles";
import type { BlockHeadingProps } from "./types";

// The title of a block of the page, with its icon and tone, and a line that says what it holds.
export function BlockHeading({
  title,
  description,
  Icon,
  tone,
}: BlockHeadingProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <h2
        className={cn(TITLE_CLASS_NAME, TONE_CLASS_NAMES[tone])}
        data-tone={tone}
      >
        <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
        {title}
      </h2>
      <p className={DESCRIPTION_CLASS_NAME}>{description}</p>
    </div>
  );
}
