import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

import { EMPTY_HINT, EMPTY_TITLE } from "../../consts";
import {
  HINT_CLASS_NAME,
  ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";

// What the month shows when nothing in it came from, or was priced in, another currency.
export function EmptyConversions() {
  return (
    <div className={ROOT_CLASS_NAME}>
      <ArrowsRightLeftIcon className={ICON_CLASS_NAME} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className={TITLE_CLASS_NAME}>{EMPTY_TITLE}</p>
        <p className={HINT_CLASS_NAME}>{EMPTY_HINT}</p>
      </div>
    </div>
  );
}
