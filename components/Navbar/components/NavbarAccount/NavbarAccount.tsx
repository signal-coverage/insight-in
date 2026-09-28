import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button, Dropdown, Separator } from "@heroui/react";

import { AccountAvatar } from "./components/AccountAvatar";
import { AccountMenuHeader } from "./components/AccountMenuHeader";
import { AccountMenuItem } from "./components/AccountMenuItem";
import { AccountMenuPlan } from "./components/AccountMenuPlan";
import {
  ACCOUNT_LABEL,
  ACCOUNT_MENU_ENTRIES,
  LOGOUT_ENTRY,
  MENU_ARIA_LABEL,
} from "./consts";
import {
  CHEVRON_CLASS_NAME,
  LABEL_CLASS_NAME,
  MENU_CLASS_NAME,
  POPOVER_CLASS_NAME,
  SEPARATOR_CLASS_NAME,
  TRIGGER_CLASS_NAME,
} from "./styles";

export function NavbarAccount() {
  return (
    <Dropdown>
      <Button variant="ghost" className={TRIGGER_CLASS_NAME}>
        <AccountAvatar size="sm" />
        <span className={LABEL_CLASS_NAME}>{ACCOUNT_LABEL}</span>
        <ChevronDownIcon className={CHEVRON_CLASS_NAME} aria-hidden="true" />
      </Button>
      <Dropdown.Popover placement="bottom end" className={POPOVER_CLASS_NAME}>
        <AccountMenuHeader />
        <Separator className={SEPARATOR_CLASS_NAME} />
        <Dropdown.Menu aria-label={MENU_ARIA_LABEL} className={MENU_CLASS_NAME}>
          {ACCOUNT_MENU_ENTRIES.map((entry) => (
            <AccountMenuItem key={entry.id} entry={entry} />
          ))}
          <Separator className={SEPARATOR_CLASS_NAME} />
          <AccountMenuPlan />
          <Separator className={SEPARATOR_CLASS_NAME} />
          <AccountMenuItem entry={LOGOUT_ENTRY} />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
