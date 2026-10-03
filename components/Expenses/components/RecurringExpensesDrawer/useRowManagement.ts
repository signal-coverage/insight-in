import { useOverlayState } from "@heroui/react";
import { useState } from "react";

import type { RecurringRow } from "../../types";
import type { TemplateFormTarget } from "./components/TemplateFormDrawer";
import { INITIAL_FORM_TARGET } from "./consts";
import type { RowErrors } from "./types";
import { withRowError } from "./utils";

// The state behind what can be done to a template at any time: the form that edits it, the two
// confirmations (disabling the month, removing the template) and the error left under a row by the
// last thing that failed. Opening anything for a row clears the error it had.
export const useRowManagement = () => {
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [formTarget, setFormTarget] =
    useState<TemplateFormTarget>(INITIAL_FORM_TARGET);
  const [toDisable, setToDisable] = useState<RecurringRow | null>(null);
  const [toRemove, setToRemove] = useState<RecurringRow | null>(null);
  const formState = useOverlayState();
  const disableState = useOverlayState();
  const removeState = useOverlayState();

  const setRowError = (id: string, message: string | null) =>
    setRowErrors((current) => withRowError(current, id, message));

  const openForm = (row: RecurringRow) => {
    setRowError(row.id, null);
    // The key remounts the form, so each opening starts from the template's values.
    setFormTarget((current) => ({ key: current.key + 1, template: row }));
    formState.open();
  };

  const openDisable = (row: RecurringRow) => {
    setRowError(row.id, null);
    setToDisable(row);
    disableState.open();
  };

  const openRemove = (row: RecurringRow) => {
    setRowError(row.id, null);
    setToRemove(row);
    removeState.open();
  };

  return {
    rowErrors,
    setRowError,
    formTarget,
    formState,
    openForm,
    toDisable,
    disableState,
    openDisable,
    toRemove,
    removeState,
    openRemove,
  };
};
