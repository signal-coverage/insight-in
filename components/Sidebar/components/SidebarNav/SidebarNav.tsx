import { SidebarNavSection } from "./components/SidebarNavSection";
import { NAV_ARIA_LABEL, NO_RESULTS_LABEL } from "./consts";
import {
  EMPTY_STATE_CLASS_NAME,
  NAV_CLASS_NAME,
  SECTIONS_CLASS_NAME,
} from "./styles";
import type { SidebarNavProps } from "./types";

export function SidebarNav({
  sections,
  isCollapsed,
  isSearchActive,
}: SidebarNavProps) {
  return (
    <nav aria-label={NAV_ARIA_LABEL} className={NAV_CLASS_NAME}>
      {sections.length === 0 ? (
        <p className={EMPTY_STATE_CLASS_NAME}>{NO_RESULTS_LABEL}</p>
      ) : (
        <div className={SECTIONS_CLASS_NAME}>
          {sections.map((section, index) => (
            <SidebarNavSection
              key={section.label ?? `untitled-${index}`}
              section={section}
              isCollapsed={isCollapsed}
              isSearchActive={isSearchActive}
            />
          ))}
        </div>
      )}
    </nav>
  );
}
