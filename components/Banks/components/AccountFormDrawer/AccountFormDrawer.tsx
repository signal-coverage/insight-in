import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { AccountFormContent } from "./AccountFormContent";
import type { AccountFormDrawerProps } from "./types";

export function AccountFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  banks,
}: AccountFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <AccountFormContent
            key={target.key}
            target={target}
            banks={banks}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
