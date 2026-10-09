import { useId } from "react";

import { SidebarNavItem } from "../SidebarNavItem";
import { getTitleClassName, LIST_CLASS_NAME } from "./styles";
import type { SidebarNavSectionProps } from "./types";

export function SidebarNavSection({
  section,
  isCollapsed,
  isSearchActive,
}: SidebarNavSectionProps) {
  const titleId = useId();
  const hasTitle = section.label !== null;

  return (
    <div>
      {hasTitle && (
        <span id={titleId} className={getTitleClassName(isCollapsed)}>
          {section.label}
        </span>
      )}
      <ul
        aria-labelledby={hasTitle ? titleId : undefined}
        className={LIST_CLASS_NAME}
      >
        {section.items.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            forceExpanded={isSearchActive ? true : undefined}
          />
        ))}
      </ul>
    </div>
  );
}
