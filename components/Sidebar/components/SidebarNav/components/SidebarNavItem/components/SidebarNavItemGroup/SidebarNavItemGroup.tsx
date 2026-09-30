import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Popover } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { getLabelClassName, ICON_CLASS_NAME } from "../../styles";
import { isActivePath } from "../../utils";
import { SidebarNavChildList } from "../SidebarNavChildList";
import {
  CHILDREN_INNER_CLASS_NAME,
  getChevronClassName,
  getChildrenWrapperClassName,
  getToggleClassName,
  POPOVER_CONTENT_CLASS_NAME,
} from "./styles";
import type { SidebarNavItemGroupProps } from "./types";

// Closing is delayed slightly so moving the pointer from the trigger to the popover
// content (which renders elsewhere in the DOM, not nested inside the trigger) doesn't
// flicker the flyout shut in the gap between the two.
const HOVER_CLOSE_DELAY_MS = 150;

export function SidebarNavItemGroup({
  item,
  isCollapsed,
  forceExpanded,
}: SidebarNavItemGroupProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded = forceExpanded ?? isOpen;
  const children = item.children ?? [];
  const isChildActive = children.some((child) => isActivePath(pathname, child.href));
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
    closeTimer.current = setTimeout(() => setIsHoverOpen(false), HOVER_CLOSE_DELAY_MS);
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
          <Popover.Content
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
      <button
        type="button"
        className={getToggleClassName(isCollapsed, isChildActive)}
        aria-expanded={isExpanded}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
        <span className={getLabelClassName(isCollapsed)}>{item.label}</span>
        <ChevronDownIcon className={getChevronClassName(isExpanded)} aria-hidden="true" />
      </button>
      {/* Always rendered (never conditionally mounted) so the grid-rows transition can
          animate both opening and closing; `inert` keeps it out of tab order while shut. */}
      <div className={getChildrenWrapperClassName(isExpanded)} inert={!isExpanded}>
        <div className={CHILDREN_INNER_CLASS_NAME}>
          <SidebarNavChildList items={children} variant="tree" />
        </div>
      </div>
    </li>
  );
}
