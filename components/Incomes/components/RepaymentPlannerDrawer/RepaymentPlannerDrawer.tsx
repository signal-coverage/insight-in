import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { RepaymentPlannerContent } from "./RepaymentPlannerContent";
import type { RepaymentPlannerDrawerProps } from "./types";

export function RepaymentPlannerDrawer({
  isOpen,
  onOpenChange,
  onClose,
  sessionKey,
  defaultDate,
  categories,
}: RepaymentPlannerDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <RepaymentPlannerContent
            key={sessionKey}
            categories={categories}
            defaultDate={defaultDate}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
