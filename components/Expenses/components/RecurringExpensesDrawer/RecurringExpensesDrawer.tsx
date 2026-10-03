import { Drawer } from "@heroui/react";

import { RecurringExpensesContent } from "./RecurringExpensesContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { RecurringExpensesDrawerProps } from "./types";

export function RecurringExpensesDrawer({
  isOpen,
  onOpenChange,
  onClose,
  sessionKey,
  data,
  categories,
}: RecurringExpensesDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <RecurringExpensesContent
            key={sessionKey}
            data={data}
            categories={categories}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
