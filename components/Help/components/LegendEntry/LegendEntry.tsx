import { cn } from "@/lib/utils/utils";

import { APPEARS_IN_LABEL } from "../../consts";
import {
  APPEARS_IN_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  ICON_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
  SWATCH_CLASS_NAME,
  SWATCH_TONE_CLASS_NAMES,
  TEXT_CLASS_NAME,
  TILE_CLASS_NAME,
  TILE_TONE_CLASS_NAMES,
} from "./styles";
import type { LegendEntryProps } from "./types";

// One thing the app shows, drawn the way the app draws it, with its name and what it means. The
// picture is decorative: the name next to it is what says what it is.
export function LegendEntry({ entry }: LegendEntryProps) {
  const { icon: Icon, tone } = entry;

  return (
    <li className={ROOT_CLASS_NAME}>
      <span
        aria-hidden="true"
        className={cn(TILE_CLASS_NAME, TILE_TONE_CLASS_NAMES[tone])}
      >
        {Icon ? (
          <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
        ) : (
          <span
            className={cn(SWATCH_CLASS_NAME, SWATCH_TONE_CLASS_NAMES[tone])}
          />
        )}
      </span>
      <div className={TEXT_CLASS_NAME}>
        <h3 className={NAME_CLASS_NAME}>{entry.name}</h3>
        <p className={DESCRIPTION_CLASS_NAME}>{entry.description}</p>
        <p className={APPEARS_IN_CLASS_NAME}>
          {APPEARS_IN_LABEL} {entry.appearsIn.join(", ")}
        </p>
      </div>
    </li>
  );
}
