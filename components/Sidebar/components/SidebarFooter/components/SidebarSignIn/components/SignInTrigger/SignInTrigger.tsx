import { ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { SIGN_IN_LABEL } from "../../consts";
import {
  COLLAPSED_TRIGGER_CLASS_NAME,
  ICON_CLASS_NAME,
  TRIGGER_CLASS_NAME,
} from "../../styles";
import type { SignInTriggerProps } from "./types";

// React Aria's Button deprecates `onClick` (it warns on every click); the press is what it
// expects, so Clerk's injected click handler is run from `onPress`.
export function SignInTrigger({ isCollapsed, onClick }: SignInTriggerProps) {
  return (
    <Button
      variant="primary"
      isIconOnly={isCollapsed}
      className={
        isCollapsed ? COLLAPSED_TRIGGER_CLASS_NAME : TRIGGER_CLASS_NAME
      }
      aria-label={SIGN_IN_LABEL}
      onPress={() => onClick?.()}
    >
      <ArrowRightEndOnRectangleIcon
        className={ICON_CLASS_NAME}
        aria-hidden="true"
      />
      {!isCollapsed && SIGN_IN_LABEL}
    </Button>
  );
}
