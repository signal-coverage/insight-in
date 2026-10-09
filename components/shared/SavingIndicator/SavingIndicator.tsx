import { Spinner } from "@heroui/react";

import { ROOT_CLASS_NAME } from "./styles";
import { SAVING_LABEL } from "./consts";

// A quiet "saving" line for controls that save as soon as they are touched (no Save button to carry
// the spinner). Rendered only while the save is in flight; a polite status, so it is announced.
export function SavingIndicator() {
  return (
    <p role="status" className={ROOT_CLASS_NAME}>
      <Spinner color="current" size="sm" aria-hidden="true" />
      {SAVING_LABEL}
    </p>
  );
}
