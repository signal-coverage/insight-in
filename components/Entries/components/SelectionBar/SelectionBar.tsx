import { TrashIcon } from "@heroicons/react/24/outline";
import { Button, Surface } from "@heroui/react";

import {
  CLEAR_LABEL,
  DELETE_LABEL,
  REGION_LABEL,
  selectedCountLabel,
} from "./consts";
import {
  BAR_CLASS_NAME,
  BUTTONS_CLASS_NAME,
  COUNT_CLASS_NAME,
  ICON_CLASS_NAME,
} from "./styles";
import type { SelectionBarProps } from "./types";

// Shown between the filters and the table while rows are selected: how many, and what to do with
// them. A region, so screen-reader users can jump to it.
export function SelectionBar({
  count,
  isDisabled = false,
  onClear,
  onDelete,
}: SelectionBarProps) {
  return (
    <Surface
      variant="secondary"
      role="region"
      aria-label={REGION_LABEL}
      className={BAR_CLASS_NAME}
    >
      <span className={COUNT_CLASS_NAME} aria-live="polite">
        {selectedCountLabel(count)}
      </span>
      <div className={BUTTONS_CLASS_NAME}>
        <Button variant="tertiary" isDisabled={isDisabled} onPress={onClear}>
          {CLEAR_LABEL}
        </Button>
        <Button
          variant="danger-soft"
          isDisabled={isDisabled}
          onPress={onDelete}
        >
          <TrashIcon className={ICON_CLASS_NAME} aria-hidden="true" />
          {DELETE_LABEL}
        </Button>
      </div>
    </Surface>
  );
}
