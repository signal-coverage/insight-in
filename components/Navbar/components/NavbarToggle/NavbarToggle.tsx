"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { useSidebar } from "@/components/Sidebar";

import { COLLAPSE_LABEL, EXPAND_LABEL } from "./consts";
import { BUTTON_CLASS_NAME, ICON_CLASS_NAME } from "./styles";

export function NavbarToggle() {
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
      <Bars3Icon className={ICON_CLASS_NAME} aria-hidden="true" />
    </Button>
  );
}
