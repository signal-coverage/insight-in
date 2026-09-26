import { SidebarNavItem } from "./components/SidebarNavItem";
import { NAV_ARIA_LABEL } from "./consts";
import { LIST_CLASS_NAME, NAV_CLASS_NAME } from "./styles";
import type { SidebarNavProps } from "./types";

export function SidebarNav({ items, isCollapsed }: SidebarNavProps) {
  return (
    <nav aria-label={NAV_ARIA_LABEL} className={NAV_CLASS_NAME}>
      <ul className={LIST_CLASS_NAME}>
        {items.map((item) => (
          <SidebarNavItem key={item.href} item={item} isCollapsed={isCollapsed} />
        ))}
      </ul>
    </nav>
  );
}
