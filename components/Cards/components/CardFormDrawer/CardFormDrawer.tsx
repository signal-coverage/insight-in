import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { CardFormContent } from "./CardFormContent";
import type { CardFormDrawerProps } from "./types";

export function CardFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  banks,
}: CardFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <CardFormContent
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
