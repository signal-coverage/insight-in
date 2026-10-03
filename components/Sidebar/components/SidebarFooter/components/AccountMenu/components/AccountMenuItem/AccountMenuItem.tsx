import { Dropdown, Label } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ICON_CLASS_NAME, ITEM_CLASS_NAME } from "./styles";
import type { AccountMenuItemProps } from "./types";

// An entry of the account menu. One that is a page takes the user there (a client transition, like
// every other navigation of the app); the others do what their `onAction` says, if anything.
export function AccountMenuItem({ entry, onAction }: AccountMenuItemProps) {
  const router = useRouter();
  const Icon = entry.icon;
  const { href } = entry;

  return (
    <Dropdown.Item
      id={entry.id}
      textValue={entry.label}
      className={ITEM_CLASS_NAME}
      onAction={href ? () => router.push(href) : onAction}
    >
      <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
      <Label>{entry.label}</Label>
    </Dropdown.Item>
  );
}
