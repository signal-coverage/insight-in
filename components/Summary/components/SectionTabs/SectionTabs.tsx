"use client";

import { Tabs } from "@heroui/react";
import type { ReactNode } from "react";

import { SUMMARY_SECTIONS, type SummarySection } from "@/core/summary/tabs";

import { SECTION_LABELS, TABS_LABEL } from "./consts";
import {
  INDICATOR_CLASS_NAME,
  LIST_CLASS_NAME,
  LIST_CONTAINER_CLASS_NAME,
  PANEL_CLASS_NAME,
  ROOT_CLASS_NAME,
  TAB_CLASS_NAME,
} from "./styles";
import type { SectionTabsProps } from "./types";

// The page's three sections as tabs: the accounts and what needs attention, the month in detail, and
// the last six months. Which one shows is decided by the address (the caller reads it and rewrites it),
// so this holds no state of its own; an inactive panel is not mounted.
export function SectionTabs({
  selected,
  onSelect,
  accounts,
  month,
  history,
}: SectionTabsProps) {
  const panels: Record<SummarySection, ReactNode> = {
    accounts,
    month,
    history,
  };

  return (
    <Tabs
      className={ROOT_CLASS_NAME}
      selectedKey={selected}
      onSelectionChange={(key) => onSelect(key as SummarySection)}
    >
      <Tabs.ListContainer className={LIST_CONTAINER_CLASS_NAME}>
        <Tabs.List aria-label={TABS_LABEL} className={LIST_CLASS_NAME}>
          {SUMMARY_SECTIONS.map((section) => (
            <Tabs.Tab key={section} id={section} className={TAB_CLASS_NAME}>
              {SECTION_LABELS[section]}
              <Tabs.Indicator className={INDICATOR_CLASS_NAME} />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {SUMMARY_SECTIONS.map((section) => (
        <Tabs.Panel key={section} id={section} className={PANEL_CLASS_NAME}>
          {panels[section]}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
