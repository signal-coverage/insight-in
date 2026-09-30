import { SignInButton } from "@clerk/nextjs";
import { ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/outline";

import { SIGN_IN_LABEL } from "./consts";
import { COLLAPSED_TRIGGER_CLASS_NAME, ICON_CLASS_NAME, TRIGGER_CLASS_NAME } from "./styles";
import type { SidebarSignInProps } from "./types";

export function SidebarSignIn({ isCollapsed }: SidebarSignInProps) {
  return (
    <SignInButton>
      <button
        type="button"
        className={isCollapsed ? COLLAPSED_TRIGGER_CLASS_NAME : TRIGGER_CLASS_NAME}
        aria-label={SIGN_IN_LABEL}
      >
        <ArrowRightEndOnRectangleIcon className={ICON_CLASS_NAME} aria-hidden="true" />
        {!isCollapsed && SIGN_IN_LABEL}
      </button>
    </SignInButton>
  );
}
