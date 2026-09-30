import { SidebarNavItem } from "./components/SidebarNavItem";
import { NAV_ARIA_LABEL, NO_RESULTS_LABEL, SECTION_LABEL } from "./consts";
import {
  EMPTY_STATE_CLASS_NAME,
  LIST_CLASS_NAME,
  NAV_CLASS_NAME,
  SECTION_LABEL_CLASS_NAME,
} from "./styles";
import type { SidebarNavProps } from "./types";

export function SidebarNav({ items, isCollapsed, isSearchActive }: SidebarNavProps) {
  return (
    <nav aria-label={NAV_ARIA_LABEL} className={NAV_CLASS_NAME}>
      {!isCollapsed && <span className={SECTION_LABEL_CLASS_NAME}>{SECTION_LABEL}</span>}
      {items.length === 0 ? (
        <p className={EMPTY_STATE_CLASS_NAME}>{NO_RESULTS_LABEL}</p>
      ) : (
        <ul className={LIST_CLASS_NAME}>
          {items.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              isCollapsed={isCollapsed}
              forceExpanded={isSearchActive ? true : undefined}
            />
          ))}
        </ul>
      )}
    </nav>
  );
}
