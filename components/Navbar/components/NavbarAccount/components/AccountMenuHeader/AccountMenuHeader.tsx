import { AccountAvatar } from "../AccountAvatar";
import { ACCOUNT_EMAIL, ACCOUNT_NAME } from "./consts";
import {
  DETAILS_CLASS_NAME,
  EMAIL_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";

export function AccountMenuHeader() {
  return (
    <div className={ROOT_CLASS_NAME}>
      <AccountAvatar size="md" />
      <div className={DETAILS_CLASS_NAME}>
        <p className={NAME_CLASS_NAME}>{ACCOUNT_NAME}</p>
        <p className={EMAIL_CLASS_NAME}>{ACCOUNT_EMAIL}</p>
      </div>
    </div>
  );
}
