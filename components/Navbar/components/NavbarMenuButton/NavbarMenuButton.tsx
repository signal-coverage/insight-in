"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { MOBILE_SIDEBAR_ID, useSidebar } from "@/components/Sidebar";

import { OPEN_MENU_LABEL } from "./consts";
import { BUTTON_CLASS_NAME, ICON_CLASS_NAME } from "./styles";

export function NavbarMenuButton() {
  const { isMobileOpen, openMobile } = useSidebar();

  return (
    <Button
      isIconOnly
      variant="ghost"
      className={BUTTON_CLASS_NAME}
      aria-label={OPEN_MENU_LABEL}
      aria-expanded={isMobileOpen}
      aria-controls={MOBILE_SIDEBAR_ID}
      onPress={openMobile}
    >
      <Bars3Icon className={ICON_CLASS_NAME} aria-hidden="true" />
    </Button>
  );
}
