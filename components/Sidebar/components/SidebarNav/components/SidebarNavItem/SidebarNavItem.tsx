import { Tooltip } from "@heroui/react";
import { usePathname } from "next/navigation";

import { SidebarNavLink } from "../SidebarNavLink";
import { SidebarNavItemGroup } from "./components/SidebarNavItemGroup";
import { getLabelClassName, getLinkClassName, ICON_CLASS_NAME } from "./styles";
import type { SidebarNavItemProps } from "./types";
import { isActivePath } from "./utils";

export function SidebarNavItem({
  item,
  isCollapsed,
  forceExpanded,
}: SidebarNavItemProps) {
  const pathname = usePathname();

  if (item.children && item.children.length > 0) {
    return (
      <SidebarNavItemGroup
        item={item}
        isCollapsed={isCollapsed}
        forceExpanded={forceExpanded}
      />
    );
  }

  const isActive = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <li>
      <Tooltip isDisabled={!isCollapsed}>
        {/* The link itself is the tooltip trigger, so it stays the only tab stop. */}
        <SidebarNavLink
          href={item.href}
          isActive={isActive}
          className={getLinkClassName(isCollapsed, isActive)}
        >
          <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
          <span className={getLabelClassName(isCollapsed)}>{item.label}</span>
        </SidebarNavLink>
        <Tooltip.Content placement="right">{item.label}</Tooltip.Content>
      </Tooltip>
    </li>
  );
}
