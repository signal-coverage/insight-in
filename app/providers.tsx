"use client";

import { I18nProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import { DISPLAY_LOCALE } from "@/lib/locale";
import { THEME_IDS } from "@/lib/themes";

import type { ProvidersProps } from "./types";

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      themes={[...THEME_IDS]}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Date fields, pickers and calendars read their language and week layout from here,
          instead of from the browser's. */}
      <I18nProvider locale={DISPLAY_LOCALE}>{children}</I18nProvider>
    </ThemeProvider>
  );
}
