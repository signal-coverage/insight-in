import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import { Button, Dropdown, Header, Label } from "@heroui/react";

import { COLUMN_TITLES } from "@/components/Roadmap/consts";
import { BOARD_STATUSES } from "@/core/roadmap/consts";
import type { BoardStatus } from "@/core/roadmap/types";

import { MENU_HEADING, moveLabel } from "./consts";
import { ICON_CLASS_NAME } from "./styles";
import type { MoveMenuProps } from "./types";

// Moves a card to the end of another column, with a menu: what makes the board usable with the
// keyboard and on a phone, where dragging is not an option. The column the card is in cannot be chosen.
export function MoveMenu({ title, status, onMove }: MoveMenuProps) {
  return (
    <Dropdown>
      <Button
        isIconOnly
        size="sm"
        variant="secondary"
        aria-label={moveLabel(title)}
      >
        <ArrowsRightLeftIcon className={ICON_CLASS_NAME} aria-hidden="true" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={MENU_HEADING}
          disabledKeys={[status]}
          onAction={(key) => onMove(key as BoardStatus)}
        >
          <Dropdown.Section>
            <Header>{MENU_HEADING}</Header>
            {BOARD_STATUSES.map((target) => (
              <Dropdown.Item
                key={target}
                id={target}
                textValue={COLUMN_TITLES[target]}
              >
                <Label>{COLUMN_TITLES[target]}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
