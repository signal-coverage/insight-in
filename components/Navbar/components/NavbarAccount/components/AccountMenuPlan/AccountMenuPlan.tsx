import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { Description, Dropdown, Label } from "@heroui/react";

import { PLAN_ID, PLAN_NAME, PLAN_USAGE } from "./consts";
import {
  DETAILS_CLASS_NAME,
  ITEM_CLASS_NAME,
  NAME_CLASS_NAME,
  UPGRADE_CLASS_NAME,
  UPGRADE_ICON_CLASS_NAME,
} from "./styles";

export function AccountMenuPlan() {
  return (
    <Dropdown.Item id={PLAN_ID} textValue={PLAN_NAME} className={ITEM_CLASS_NAME}>
      <div className={DETAILS_CLASS_NAME}>
        <Label className={NAME_CLASS_NAME}>{PLAN_NAME}</Label>
        <Description>{PLAN_USAGE}</Description>
      </div>
      <span className={UPGRADE_CLASS_NAME} aria-hidden="true">
        <ArrowUpTrayIcon className={UPGRADE_ICON_CLASS_NAME} />
      </span>
    </Dropdown.Item>
  );
}
