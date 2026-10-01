import { SwatchIcon } from "@heroicons/react/24/outline";
import { Dropdown, Label } from "@heroui/react";
import { useTheme } from "next-themes";

import { THEME_IDS, THEMES } from "@/lib/themes";

import { THEME_ID, THEME_LABEL } from "./consts";
import { ICON_CLASS_NAME, ITEM_CLASS_NAME, OPTION_CLASS_NAME } from "./styles";
import type { AccountMenuThemeProps } from "./types";
import { useThemeTransition } from "./useThemeTransition";
import { selectedThemeId } from "./utils";

export function AccountMenuTheme({
  popoverClassName,
  menuClassName,
}: AccountMenuThemeProps) {
  // The theme showing, not the stored choice: until one is picked, the device's light/dark
  // setting decides, and the list should still tick what the person sees.
  const { resolvedTheme, setTheme } = useTheme();
  const { isTransitioning, changeTheme } = useThemeTransition(setTheme);

  return (
    <Dropdown.SubmenuTrigger>
      <Dropdown.Item
        id={THEME_ID}
        textValue={THEME_LABEL}
        className={ITEM_CLASS_NAME}
      >
        <SwatchIcon className={ICON_CLASS_NAME} aria-hidden="true" />
        <Label>{THEME_LABEL}</Label>
        <Dropdown.SubmenuIndicator />
      </Dropdown.Item>
      <Dropdown.Popover className={popoverClassName}>
        <Dropdown.Menu
          aria-label={THEME_LABEL}
          className={menuClassName}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set(resolvedTheme ? [resolvedTheme] : [])}
          // Locked while the animation runs: see useThemeTransition.
          disabledKeys={isTransitioning ? THEME_IDS : []}
          onSelectionChange={(selection) => {
            const id = selectedThemeId(selection);

            if (id) changeTheme(id);
          }}
        >
          {THEMES.map((theme) => (
            <Dropdown.Item
              key={theme.id}
              id={theme.id}
              textValue={theme.label}
              className={OPTION_CLASS_NAME}
              shouldCloseOnSelect={false}
            >
              <Dropdown.ItemIndicator />
              <Label>{theme.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.SubmenuTrigger>
  );
}
