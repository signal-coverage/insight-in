import { Drawer } from "@heroui/react";

import { RepaymentsContent } from "./RepaymentsContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { RepaymentsDrawerProps } from "./types";

export function RepaymentsDrawer({
  isOpen,
  onOpenChange,
  onClose,
  sessionKey,
  data,
}: RepaymentsDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DIALOG_CLASS_NAME}>
          <RepaymentsContent key={sessionKey} data={data} onClose={onClose} />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
