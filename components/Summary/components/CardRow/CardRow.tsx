import { cn } from "@/lib/utils/utils";

import {
  HEADING_CLASS_NAME,
  HEADING_TONE_CLASS_NAMES,
  ICON_CLASS_NAME,
  LIST_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { CardRowProps } from "./types";

// A row of cards that read together (the incomes of a currency, its expenses, its remainders),
// under a title that says which of them it is.
export function CardRow({ label, title, Icon, tone, children }: CardRowProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <h4
        className={cn(HEADING_CLASS_NAME, HEADING_TONE_CLASS_NAMES[tone])}
        data-tone={tone}
      >
        <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
        {title}
      </h4>
      <ul className={LIST_CLASS_NAME} aria-label={label}>
        {children}
      </ul>
    </div>
  );
}
