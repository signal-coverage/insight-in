import { Dropdown, Label } from "@heroui/react";

import { ICON_CLASS_NAME, ITEM_CLASS_NAME } from "./styles";
import type { AccountMenuItemProps } from "./types";

export function AccountMenuItem({ entry }: AccountMenuItemProps) {
  const Icon = entry.icon;

  return (
    <Dropdown.Item id={entry.id} textValue={entry.label} className={ITEM_CLASS_NAME}>
      <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
      <Label>{entry.label}</Label>
    </Dropdown.Item>
  );
}
