"use client";

import { Skeleton } from "@heroui/react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { Await } from "@/components/shared/Await";
import { ExpectedIncomesSwitch } from "@/components/Summary/components/ExpectedIncomesSwitch";

import { SettingsSection } from "./components/SettingsSection";
import { ThemePicker } from "./components/ThemePicker";
import {
  APPEARANCE_SECTION_DESCRIPTION,
  APPEARANCE_SECTION_ID,
  APPEARANCE_SECTION_TITLE,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  SUMMARY_SECTION_ID,
  SUMMARY_SECTION_TITLE,
} from "./consts";
import { ROOT_CLASS_NAME, SWITCH_SKELETON_CLASS_NAME } from "./styles";
import type { SettingsProps } from "./types";

// The app's preferences, one section each. The summary's switch is the very one the summary page
// shows (same component, same saved value), so changing it here or there is the same change.
export function Settings({ includeExpectedIncomes }: SettingsProps) {
  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

      <SettingsSection id={SUMMARY_SECTION_ID} title={SUMMARY_SECTION_TITLE}>
        <Await
          source={includeExpectedIncomes}
          fallback={<Skeleton className={SWITCH_SKELETON_CLASS_NAME} />}
        >
          {(isSelected) => <ExpectedIncomesSwitch isSelected={isSelected} />}
        </Await>
      </SettingsSection>

      <SettingsSection
        id={APPEARANCE_SECTION_ID}
        title={APPEARANCE_SECTION_TITLE}
        description={APPEARANCE_SECTION_DESCRIPTION}
      >
        <ThemePicker />
      </SettingsSection>
    </main>
  );
}
