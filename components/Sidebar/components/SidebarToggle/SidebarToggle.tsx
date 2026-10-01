import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { useSidebar } from "../SidebarProvider";
import { COLLAPSE_LABEL, EXPAND_LABEL } from "./consts";
import { BUTTON_CLASS_NAME, getIconClassName } from "./styles";

export function SidebarToggle() {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <Button
      isIconOnly
      variant="ghost"
      className={BUTTON_CLASS_NAME}
      aria-label={isCollapsed ? EXPAND_LABEL : COLLAPSE_LABEL}
      aria-expanded={!isCollapsed}
      onPress={toggle}
    >
      {/* Points right when collapsed (click to expand) and left when expanded
          (click to collapse) — one icon, flipped, rather than swapping icons. */}
      <ChevronRightIcon
        className={getIconClassName(isCollapsed)}
        aria-hidden="true"
      />
    </Button>
  );
}
