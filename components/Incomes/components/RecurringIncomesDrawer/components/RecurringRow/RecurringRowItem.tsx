import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { Button } from "@heroui/react";

import { deleteLabel, editLabel } from "@/components/Entries/consts";
import {
  ACTION_ICON_CLASS_NAME,
  ACTIONS_CLASS_NAME,
  AMOUNT_CLASS_NAME,
  META_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
  SUMMARY_CLASS_NAME,
  TITLE_ROW_CLASS_NAME,
  VIEW_ROW_CLASS_NAME,
} from "./styles";
import type { RecurringRowItemProps } from "./types";

export function RecurringRowItem({
  item,
  error,
  onEdit,
  onDelete,
}: RecurringRowItemProps) {
  return (
    <li className={ROOT_CLASS_NAME}>
      <div className={VIEW_ROW_CLASS_NAME}>
        <div className={SUMMARY_CLASS_NAME}>
          <div className={TITLE_ROW_CLASS_NAME}>
            <span className={NAME_CLASS_NAME} title={item.description}>
              {item.description}
            </span>
            <span className={AMOUNT_CLASS_NAME}>{item.amountLabel}</span>
          </div>
          <span className={META_CLASS_NAME}>
            {item.frequencyLabel} · {item.categoryName}
          </span>
          <span className={META_CLASS_NAME}>{item.nextLabel}</span>
          {item.endLabel ? (
            <span className={META_CLASS_NAME}>{item.endLabel}</span>
          ) : null}
        </div>
        <div className={ACTIONS_CLASS_NAME}>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            aria-label={editLabel(item.description)}
            onPress={() => onEdit(item)}
          >
            <PencilSquareIcon
              className={ACTION_ICON_CLASS_NAME}
              aria-hidden="true"
            />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="danger-soft"
            aria-label={deleteLabel(item.description)}
            onPress={() => onDelete(item)}
          >
            <TrashIcon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
    </li>
  );
}
