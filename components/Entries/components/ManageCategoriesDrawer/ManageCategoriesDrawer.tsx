import { Drawer } from "@heroui/react";

import { ManageCategoriesContent } from "./ManageCategoriesContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { ManageCategoriesDrawerProps } from "./types";

export function ManageCategoriesDrawer({
  isOpen,
  onOpenChange,
  onClose,
  categories,
  copy,
  actions,
}: ManageCategoriesDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <ManageCategoriesContent
            categories={categories}
            copy={copy}
            actions={actions}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
