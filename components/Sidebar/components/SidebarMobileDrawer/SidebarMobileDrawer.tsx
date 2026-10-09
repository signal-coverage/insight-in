"use client";

import { Drawer } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useEffect, type MouseEvent } from "react";

import { SidebarContent } from "../SidebarContent";
import { useSidebar } from "../SidebarProvider";
import { MOBILE_SIDEBAR_ID, MOBILE_SIDEBAR_LABEL } from "./consts";
import { DIALOG_CLASS_NAME } from "./styles";

// The sidebar as an overlay panel below the md breakpoint. Always the full labelled sidebar:
// the collapsed (icon-only) mode is a desktop idea.
export function SidebarMobileDrawer() {
  const { isMobileOpen, setMobileOpen, closeMobile } = useSidebar();

  // The dashboard layout stays mounted across navigations, so the panel has to close itself when
  // the route changes (however the navigation happened).
  const pathname = usePathname();
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  // Choosing a destination closes the panel (a click on any link, however deep in the nav).
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a[href]")) {
      closeMobile();
    }
  };

  return (
    <Drawer.Backdrop isOpen={isMobileOpen} onOpenChange={setMobileOpen}>
      <Drawer.Content placement="left">
        <Drawer.Dialog
          id={MOBILE_SIDEBAR_ID}
          aria-label={MOBILE_SIDEBAR_LABEL}
          className={DIALOG_CLASS_NAME}
          onClick={closeOnLink}
        >
          <SidebarContent isCollapsed={false} />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
