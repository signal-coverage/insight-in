import { Avatar } from "@heroui/react";

import { ACCOUNT_INITIALS } from "./consts";
import { AVATAR_CLASS_NAME, AVATAR_FALLBACK_CLASS_NAME } from "./styles";
import type { AccountAvatarProps } from "./types";

export function AccountAvatar({ size = "sm" }: AccountAvatarProps) {
  return (
    <Avatar size={size} className={AVATAR_CLASS_NAME} aria-hidden="true">
      <Avatar.Fallback className={AVATAR_FALLBACK_CLASS_NAME}>
        {ACCOUNT_INITIALS}
      </Avatar.Fallback>
    </Avatar>
  );
}
