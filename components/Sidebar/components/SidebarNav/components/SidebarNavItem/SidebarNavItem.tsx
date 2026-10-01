import { Tooltip } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
        <Tooltip.Trigger<"a">
          className={getLinkClassName(isCollapsed, isActive)}
          render={(props) => (
            <Link
              {...props}
              href={item.href}
              role={undefined}
              aria-current={isActive ? "page" : undefined}
            />
          )}
        >
          <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
          <span className={getLabelClassName(isCollapsed)}>{item.label}</span>
        </Tooltip.Trigger>
        <Tooltip.Content placement="right">{item.label}</Tooltip.Content>
      </Tooltip>
    </li>
  );
}
