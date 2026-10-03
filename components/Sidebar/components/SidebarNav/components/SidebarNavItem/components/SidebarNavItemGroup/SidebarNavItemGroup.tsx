import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Disclosure, Popover } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { getLabelClassName, ICON_CLASS_NAME } from "../../styles";
import { isActivePath } from "../../utils";
import { SidebarNavChildList } from "../SidebarNavChildList";
import { HOVER_CLOSE_DELAY_MS } from "./consts";
import {
  CHEVRON_CLASS_NAME,
  getToggleClassName,
  POPOVER_CONTENT_CLASS_NAME,
} from "./styles";
import type { SidebarNavItemGroupProps } from "./types";

export function SidebarNavItemGroup({
  item,
  isCollapsed,
  forceExpanded,
}: SidebarNavItemGroupProps) {
  const pathname = usePathname();
  const children = item.children ?? [];
  const isChildActive = children.some((child) =>
    isActivePath(pathname, child.href, child.exact),
  );
  // A group opens on its own when the page being shown lives inside it.
  const [isOpen, setIsOpen] = useState(isChildActive);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded = forceExpanded ?? isOpen;
  const Icon = item.icon;

  const cancelHoverClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const openOnHover = () => {
    cancelHoverClose();
    setIsHoverOpen(true);
  };

  const closeOnHoverEnd = () => {
    cancelHoverClose();
    closeTimer.current = setTimeout(
      () => setIsHoverOpen(false),
      HOVER_CLOSE_DELAY_MS,
    );
  };

  if (isCollapsed) {
    return (
      <li>
        <Popover isOpen={isHoverOpen} onOpenChange={setIsHoverOpen}>
          <Popover.Trigger
            className={getToggleClassName(isCollapsed, isChildActive)}
            onMouseEnter={openOnHover}
            onMouseLeave={closeOnHoverEnd}
          >
            <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
            <span className={getLabelClassName(isCollapsed)}>{item.label}</span>
          </Popover.Trigger>
          {/* Non-modal on purpose: a modal popover renders a full-screen underlay that lands
              on top of the trigger, so the browser reports the pointer as having left it and
              the hover flyout would close and reopen in a loop. */}
          <Popover.Content
            isNonModal
            placement="right top"
            className={POPOVER_CONTENT_CLASS_NAME}
            onMouseEnter={openOnHover}
            onMouseLeave={closeOnHoverEnd}
          >
            <Popover.Dialog>
              <SidebarNavChildList items={children} variant="flyout" />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </li>
    );
  }

  return (
    <li>
      <Disclosure isExpanded={isExpanded} onExpandedChange={setIsOpen}>
        {/* No Disclosure.Heading: it would add a heading to the sidebar's outline. */}
        <Disclosure.Trigger
          className={getToggleClassName(isCollapsed, isChildActive)}
        >
          <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
          <span className={getLabelClassName(isCollapsed)}>{item.label}</span>
          <Disclosure.Indicator className={CHEVRON_CLASS_NAME}>
            <ChevronDownIcon aria-hidden="true" />
          </Disclosure.Indicator>
        </Disclosure.Trigger>
        {/* The panel stays mounted so the height transition can animate both opening and
            closing; Disclosure hides it from the accessibility tree and the tab order while
            shut. */}
        <Disclosure.Content>
          <SidebarNavChildList items={children} variant="tree" />
        </Disclosure.Content>
      </Disclosure>
    </li>
  );
}
