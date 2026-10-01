import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { ExpenseFormContent } from "./ExpenseFormContent";
import type { ExpenseFormDrawerProps } from "./types";

export function ExpenseFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  categories,
}: ExpenseFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <ExpenseFormContent
            key={target.key}
            target={target}
            categories={categories}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
