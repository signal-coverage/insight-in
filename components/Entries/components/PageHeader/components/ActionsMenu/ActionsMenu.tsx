import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, Dropdown, Label } from "@heroui/react";

import {
  CHEVRON_CLASS_NAME,
  ITEM_ICON_CLASS_NAME,
  TRIGGER_CLASS_NAME,
} from "./styles";
import type { ActionsMenuProps } from "./types";

// The page header's one button: a menu with every action of the page, so the header never grows a
// row of competing buttons.
export function ActionsMenu({ label, items, onAction }: ActionsMenuProps) {
  return (
    <Dropdown>
      <Button className={TRIGGER_CLASS_NAME}>
        {label}
        <ChevronDownIcon className={CHEVRON_CLASS_NAME} aria-hidden="true" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map(({ id, label: itemLabel, Icon }) => (
            <Dropdown.Item key={id} id={id} textValue={itemLabel}>
              <Icon className={ITEM_ICON_CLASS_NAME} aria-hidden="true" />
              <Label>{itemLabel}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
