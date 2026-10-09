import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";

import { TemplateFormContent } from "./TemplateFormContent";
import type { TemplateFormDrawerProps } from "./types";

export function TemplateFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  categories,
  accounts,
}: TemplateFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          {target.template ? (
            <TemplateFormContent
              key={target.key}
              template={target.template}
              categories={categories}
              accounts={accounts}
              onClose={onClose}
            />
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
