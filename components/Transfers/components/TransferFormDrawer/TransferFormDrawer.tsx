import { Drawer } from "@heroui/react";

import { TransferFormContent } from "./TransferFormContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { TransferFormDrawerProps } from "./types";

export function TransferFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  accounts,
}: TransferFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <TransferFormContent
            key={target.key}
            target={target}
            accounts={accounts}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
