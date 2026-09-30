import { Show } from "@clerk/nextjs";

import { AccountMenu } from "./components/AccountMenu";
import { SidebarSignIn } from "./components/SidebarSignIn";
import { ROOT_CLASS_NAME } from "./styles";
import type { SidebarFooterProps } from "./types";

export function SidebarFooter({ isCollapsed }: SidebarFooterProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Show when="signed-in">
        <AccountMenu isCollapsed={isCollapsed} />
      </Show>
      <Show when="signed-out">
        <SidebarSignIn isCollapsed={isCollapsed} />
      </Show>
    </div>
  );
}
