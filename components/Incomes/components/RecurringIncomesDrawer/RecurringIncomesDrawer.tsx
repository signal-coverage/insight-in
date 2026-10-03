import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";
import { RecurringIncomesContent } from "./RecurringIncomesContent";
import type { RecurringIncomesDrawerProps } from "./types";

export function RecurringIncomesDrawer({
  isOpen,
  onOpenChange,
  onClose,
  recurring,
  onAdd,
  onEdit,
}: RecurringIncomesDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <RecurringIncomesContent
            recurring={recurring}
            onClose={onClose}
            onAdd={onAdd}
            onEdit={onEdit}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
