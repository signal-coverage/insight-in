import { Avatar } from "@heroui/react";

import { ACCOUNT_EMAIL, ACCOUNT_INITIALS, ACCOUNT_NAME } from "./consts";
import {
  AVATAR_CLASS_NAME,
  AVATAR_FALLBACK_CLASS_NAME,
  DETAILS_CLASS_NAME,
  EMAIL_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";

export function AccountMenuHeader() {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Avatar size="md" className={AVATAR_CLASS_NAME} aria-hidden="true">
        <Avatar.Fallback className={AVATAR_FALLBACK_CLASS_NAME}>
          {ACCOUNT_INITIALS}
        </Avatar.Fallback>
      </Avatar>
      <div className={DETAILS_CLASS_NAME}>
        <p className={NAME_CLASS_NAME}>{ACCOUNT_NAME}</p>
        <p className={EMAIL_CLASS_NAME}>{ACCOUNT_EMAIL}</p>
      </div>
    </div>
  );
}
