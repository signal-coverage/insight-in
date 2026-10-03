import { usePathname } from "next/navigation";

import { SidebarNavLink } from "../../../SidebarNavLink";
import { isActivePath } from "../../utils";
import {
  getChildLinkClassName,
  getDisabledChildClassName,
  getItemClassName,
  getListClassName,
} from "./styles";
import type { SidebarNavChildListProps } from "./types";

export function SidebarNavChildList({
  items,
  variant,
}: SidebarNavChildListProps) {
  const pathname = usePathname();

  return (
    <ul className={getListClassName(variant)}>
      {items.map((child, index) => {
        const isActive = isActivePath(pathname, child.href, child.exact);
        const isLast = index === items.length - 1;

        return (
          <li key={child.href} className={getItemClassName(isLast)}>
            {child.disabled ? (
              <span
                className={getDisabledChildClassName()}
                aria-disabled="true"
              >
                {child.label}
              </span>
            ) : (
              <SidebarNavLink
                href={child.href}
                isActive={isActive}
                className={getChildLinkClassName(isActive)}
              >
                {child.label}
              </SidebarNavLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}
