import { Drawer } from "@heroui/react";

import { IncomeFormContent } from "./IncomeFormContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { IncomeFormDrawerProps } from "./types";

export function IncomeFormDrawer({
  isOpen,
  onOpenChange,
  onClose,
  target,
  categories,
  reimbursables,
  accounts,
}: IncomeFormDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <IncomeFormContent
            key={target.key}
            target={target}
            categories={categories}
            reimbursables={reimbursables}
            accounts={accounts}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
