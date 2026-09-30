import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { Dropdown, Label, Switch } from "@heroui/react";
import { useTheme } from "next-themes";

import { DARK_THEME, LIGHT_THEME, THEME_ID, THEME_LABEL } from "./consts";
import { ICON_CLASS_NAME, ITEM_CLASS_NAME, SWITCH_CLASS_NAME } from "./styles";
import { runThemeTransition } from "./utils";

export function AccountMenuTheme() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === DARK_THEME;
  const Icon = isDark ? MoonIcon : SunIcon;

  return (
    <Dropdown.Item
      id={THEME_ID}
      textValue={THEME_LABEL}
      className={ITEM_CLASS_NAME}
      shouldCloseOnSelect={false}
      onAction={() =>
        runThemeTransition(() => setTheme(isDark ? LIGHT_THEME : DARK_THEME))
      }
    >
      <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
      <Label>{THEME_LABEL}</Label>
      <Switch isSelected={isDark} className={SWITCH_CLASS_NAME} aria-label={THEME_LABEL}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </Dropdown.Item>
  );
}
