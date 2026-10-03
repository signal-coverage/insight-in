import type { THEMES } from "@/lib/themes";

export interface ThemeOptionProps {
  theme: (typeof THEMES)[number];
}
