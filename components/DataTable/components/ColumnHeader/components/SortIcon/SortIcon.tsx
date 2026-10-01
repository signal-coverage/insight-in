import {
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

import { SORT_ICON_CLASSNAME, UNSORTED_ICON_CLASSNAME } from "./styles";
import type { SortIconProps } from "./types";

export function SortIcon({ direction }: SortIconProps) {
  if (direction === "ascending") {
    return <ChevronUpIcon className={SORT_ICON_CLASSNAME} aria-hidden="true" />;
  }

  if (direction === "descending") {
    return (
      <ChevronDownIcon className={SORT_ICON_CLASSNAME} aria-hidden="true" />
    );
  }

  return (
    <ChevronUpDownIcon className={UNSORTED_ICON_CLASSNAME} aria-hidden="true" />
  );
}
