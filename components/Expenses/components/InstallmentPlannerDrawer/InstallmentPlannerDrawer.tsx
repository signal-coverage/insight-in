import { Drawer } from "@heroui/react";

import { DRAWER_DIALOG_CLASS_NAME } from "@/components/Entries/styles";
import { isCreditCard } from "@/core/cards/kinds";

import { InstallmentPlannerContent } from "./InstallmentPlannerContent";
import type { InstallmentPlannerDrawerProps } from "./types";

export function InstallmentPlannerDrawer({
  isOpen,
  onOpenChange,
  onClose,
  sessionKey,
  defaultDate,
  categories,
  cards,
  accounts,
}: InstallmentPlannerDrawerProps) {
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className={DRAWER_DIALOG_CLASS_NAME}>
          {/* A purchase in installments is paid with a credit card: the debit ones never reach the
              planner. */}
          <InstallmentPlannerContent
            key={sessionKey}
            categories={categories}
            cards={cards.filter(isCreditCard)}
            accounts={accounts}
            defaultDate={defaultDate}
            onClose={onClose}
          />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
