import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { InstallmentPlannerContent } from "./InstallmentPlannerContent";
import type { InstallmentPlannerDrawerProps } from "./types";

export function InstallmentPlannerDrawer({
  isOpen,
  onOpenChange,
  onClose,
  sessionKey,
  defaultDate,
  categories,
  cards,
}: InstallmentPlannerDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <InstallmentPlannerContent
            key={sessionKey}
            categories={categories}
            cards={cards}
            defaultDate={defaultDate}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
