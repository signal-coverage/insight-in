import { RadioGroup } from "@heroui/react";
import { useTheme } from "next-themes";

import { useThemeTransition } from "@/components/Sidebar/components/SidebarFooter/components/AccountMenu/components/AccountMenuTheme";
import { THEMES } from "@/lib/themes";
import { useIsHydrated } from "@/lib/utils/useIsHydrated";

import { ThemeOption } from "./components/ThemeOption";
import { THEME_PICKER_LABEL } from "./consts";
import { GROUP_CLASS_NAME } from "./styles";

// Every theme of the app as a choice, each with a preview of its five colours. It applies a theme
// the way the account menu's Tema submenu does (same animation, same one-at-a-time rule, same
// storage through next-themes), so both lists always agree.
export function ThemePicker() {
  // The theme showing, not the stored choice: until one is picked, the device's light/dark
  // setting decides, and the list should still tick what the person sees.
  const { resolvedTheme, setTheme } = useTheme();
  const { changeTheme } = useThemeTransition(setTheme);
  // The server cannot know the stored theme, but the client's first render already does: ticking it
  // right away would not match the server's HTML. So nothing is ticked until the page is hydrated.
  const isHydrated = useIsHydrated();

  return (
    <RadioGroup
      aria-label={THEME_PICKER_LABEL}
      variant="secondary"
      className={GROUP_CLASS_NAME}
      value={isHydrated ? (resolvedTheme ?? "") : ""}
      onChange={changeTheme}
    >
      {THEMES.map((theme) => (
        <ThemeOption key={theme.id} theme={theme} />
      ))}
    </RadioGroup>
  );
}
