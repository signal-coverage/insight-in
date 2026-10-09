import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { BankFormContent } from "./BankFormContent";
import type { BankFormDrawerProps } from "./types";

export function BankFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
}: BankFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <BankFormContent key={target.key} target={target} onClose={onClose} />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
