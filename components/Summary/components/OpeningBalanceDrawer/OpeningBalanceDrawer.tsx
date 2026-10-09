import { Drawer } from "@heroui/react";

import { OpeningBalanceContent } from "./OpeningBalanceContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { OpeningBalanceDrawerProps } from "./types";

// The opening balance editor: how much each account held when the month the user chooses began.
export function OpeningBalanceDrawer({
  isOpen,
  onOpenChange,
  onClose,
  currentMonth,
  data,
  sessionKey,
}: OpeningBalanceDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <OpeningBalanceContent
            key={sessionKey}
            currentMonth={currentMonth}
            data={data}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
