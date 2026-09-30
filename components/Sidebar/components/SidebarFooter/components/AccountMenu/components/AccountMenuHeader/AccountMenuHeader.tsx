import { Avatar } from "@heroui/react";

import {
  AVATAR_CLASS_NAME,
  AVATAR_FALLBACK_CLASS_NAME,
  DETAILS_CLASS_NAME,
  EMAIL_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AccountMenuHeaderProps } from "./types";

export function AccountMenuHeader({ name, email, imageUrl, initials }: AccountMenuHeaderProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Avatar size="md" className={AVATAR_CLASS_NAME} aria-hidden="true">
        <Avatar.Image src={imageUrl} alt="" />
        <Avatar.Fallback className={AVATAR_FALLBACK_CLASS_NAME}>{initials}</Avatar.Fallback>
      </Avatar>
      <div className={DETAILS_CLASS_NAME}>
        <p className={NAME_CLASS_NAME}>{name}</p>
        <p className={EMAIL_CLASS_NAME}>{email}</p>
      </div>
    </div>
  );
}
