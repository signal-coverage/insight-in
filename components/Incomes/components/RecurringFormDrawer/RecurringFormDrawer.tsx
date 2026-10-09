import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";
import { RecurringFormContent } from "./RecurringFormContent";
import type { RecurringFormDrawerProps } from "./types";

export function RecurringFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  categories,
  accounts,
}: RecurringFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <RecurringFormContent
            key={target.key}
            target={target}
            categories={categories}
            accounts={accounts}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
