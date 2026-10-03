import {
  Bars2Icon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Button, Card } from "@heroui/react";
import { GridListItem } from "react-aria-components";

import { deleteLabel, editLabel } from "@/components/Entries/consts";
import { ACTION_ICON_CLASS_NAME } from "@/components/Entries/tableStyles";
import { formatIncomeDate } from "@/core/incomes/dates";

import { MoveMenu } from "./components/MoveMenu";
import { createdLabel } from "./consts";
import {
  ACTIONS_CLASS_NAME,
  CARD_CLASS_NAME,
  DATE_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  DRAG_HANDLE_CLASS_NAME,
  HEADER_CLASS_NAME,
  ITEM_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { BoardCardProps } from "./types";

// One card of the board. The row is what React Aria drags (with the pointer, or with the keyboard
// once it is picked up); the card inside shows the text, and its buttons are the ways to change it
// that do not depend on dragging: move it with a menu, edit it, delete it.
export function BoardCard({ item, onMove, onEdit, onDelete }: BoardCardProps) {
  return (
    <GridListItem
      id={item.id}
      textValue={item.title}
      className={ITEM_CLASS_NAME}
    >
      <Card variant="tertiary" className={CARD_CLASS_NAME}>
        <Card.Header className={HEADER_CLASS_NAME}>
          <Card.Title className={TITLE_CLASS_NAME}>{item.title}</Card.Title>
          {/* The handle React Aria needs so keyboard and screen reader users can drag the card. Hidden
              from view: the mouse drags the whole card. */}
          <Button
            isIconOnly
            slot="drag"
            size="sm"
            variant="ghost"
            className={DRAG_HANDLE_CLASS_NAME}
          >
            <Bars2Icon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
          </Button>
        </Card.Header>
        <Card.Content>
          {item.description ? (
            <p className={DESCRIPTION_CLASS_NAME}>{item.description}</p>
          ) : null}
          <time className={DATE_CLASS_NAME} dateTime={item.createdAt}>
            {createdLabel(formatIncomeDate(item.createdAt))}
          </time>
        </Card.Content>
        <Card.Footer className={ACTIONS_CLASS_NAME}>
          <MoveMenu
            title={item.title}
            status={item.status}
            onMove={(status) => onMove(item.id, status)}
          />
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            aria-label={editLabel(item.title)}
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
            aria-label={deleteLabel(item.title)}
            onPress={() => onDelete(item)}
          >
            <TrashIcon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
          </Button>
        </Card.Footer>
      </Card>
    </GridListItem>
  );
}
