import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Avatar, Button, Dropdown, Separator } from "@heroui/react";

import { AccountMenuHeader } from "./components/AccountMenuHeader";
import { AccountMenuItem } from "./components/AccountMenuItem";
import { AccountMenuPlan } from "./components/AccountMenuPlan";
import { AccountMenuTheme } from "./components/AccountMenuTheme";
import {
  ACCOUNT_FALLBACK_LABEL,
  ACCOUNT_MENU_ENTRIES,
  LOGOUT_ENTRY,
  MENU_ARIA_LABEL,
} from "./consts";
import {
  AVATAR_CLASS_NAME,
  AVATAR_FALLBACK_CLASS_NAME,
  CHEVRON_CLASS_NAME,
  COLLAPSED_TRIGGER_CLASS_NAME,
  DETAILS_CLASS_NAME,
  EMAIL_CLASS_NAME,
  MENU_CLASS_NAME,
  NAME_CLASS_NAME,
  POPOVER_CLASS_NAME,
  SEPARATOR_CLASS_NAME,
  TRIGGER_CLASS_NAME,
} from "./styles";
import type { AccountMenuProps } from "./types";
import { getInitials } from "./utils";

export function AccountMenu({ isCollapsed }: AccountMenuProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const name = user?.fullName ?? ACCOUNT_FALLBACK_LABEL;
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const imageUrl = user?.imageUrl;
  const initials = getInitials(name);

  return (
    <Dropdown>
      {isCollapsed ? (
        <Button
          isIconOnly
          variant="ghost"
          className={COLLAPSED_TRIGGER_CLASS_NAME}
          aria-label={MENU_ARIA_LABEL}
        >
          <Avatar size="sm" className={AVATAR_CLASS_NAME} aria-hidden="true">
            <Avatar.Image src={imageUrl} alt="" />
            <Avatar.Fallback className={AVATAR_FALLBACK_CLASS_NAME}>
              {initials}
            </Avatar.Fallback>
          </Avatar>
        </Button>
      ) : (
        <Button variant="ghost" className={TRIGGER_CLASS_NAME} aria-label={MENU_ARIA_LABEL}>
          <Avatar size="md" className={AVATAR_CLASS_NAME} aria-hidden="true">
            <Avatar.Image src={imageUrl} alt="" />
            <Avatar.Fallback className={AVATAR_FALLBACK_CLASS_NAME}>
              {initials}
            </Avatar.Fallback>
          </Avatar>
          <span className={DETAILS_CLASS_NAME}>
            <span className={NAME_CLASS_NAME}>{name}</span>
            <span className={EMAIL_CLASS_NAME}>{email}</span>
          </span>
          <ChevronDownIcon className={CHEVRON_CLASS_NAME} aria-hidden="true" />
        </Button>
      )}
      <Dropdown.Popover placement="right top" className={POPOVER_CLASS_NAME}>
        <AccountMenuHeader name={name} email={email} imageUrl={imageUrl} initials={initials} />
        <Separator className={SEPARATOR_CLASS_NAME} />
        <Dropdown.Menu aria-label={MENU_ARIA_LABEL} className={MENU_CLASS_NAME}>
          {ACCOUNT_MENU_ENTRIES.map((entry) => (
            <AccountMenuItem key={entry.id} entry={entry} />
          ))}
          <AccountMenuTheme />
          <Separator className={SEPARATOR_CLASS_NAME} />
          <AccountMenuPlan />
          <Separator className={SEPARATOR_CLASS_NAME} />
          <AccountMenuItem entry={LOGOUT_ENTRY} onAction={() => void signOut()} />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
