import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { ItemFormContent } from "./ItemFormContent";
import type { ItemFormDrawerProps } from "./types";

export function ItemFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
}: ItemFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          <ItemFormContent key={target.key} target={target} onClose={onClose} />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
