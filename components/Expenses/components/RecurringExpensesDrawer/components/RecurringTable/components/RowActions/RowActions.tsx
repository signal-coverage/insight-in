import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useTransition } from "react";

import { editLabel } from "@/components/Entries/consts";
import { PendingButton } from "@/components/shared/PendingButton";
import { setRecurringDecisionAction } from "@/core/expenses/recurringActions";

import {
  DISABLE_LABEL,
  disableAriaLabel,
  ENABLE_LABEL,
  ENABLE_PENDING_LABEL,
  enableAriaLabel,
  removeLabel,
} from "./consts";
import {
  ACTION_ICON_CLASS_NAME,
  ICONS_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { RowActionsProps } from "./types";

// What can be done with a template at any time: edit it, remove it, and, once this month's decision
// was made, change it (Habilitar on a disabled one, Deshabilitar on an enabled one). A template
// still waiting for its decision has the radios for that instead.
export function RowActions({
  row,
  isDisabled,
  onEdit,
  onRemove,
  onDisable,
  onError,
}: RowActionsProps) {
  const [isEnabling, startTransition] = useTransition();
  const isLocked = isDisabled || isEnabling;

  const handleEnable = () => {
    onError(row.id, null);

    startTransition(async () => {
      const result = await setRecurringDecisionAction(row.id, "ENABLED");

      if (result.status === "error") {
        onError(row.id, result.message);
      }
    });
  };

  return (
    <div className={ROOT_CLASS_NAME}>
      <div className={ICONS_CLASS_NAME}>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label={editLabel(row.description)}
          isDisabled={isLocked}
          onPress={() => onEdit(row)}
        >
          <PencilSquareIcon
            className={ACTION_ICON_CLASS_NAME}
            aria-hidden="true"
          />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
          aria-label={removeLabel(row.description)}
          isDisabled={isLocked}
          onPress={() => onRemove(row)}
        >
          <TrashIcon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
        </Button>
      </div>

      {row.decision === "DISABLED" ? (
        <PendingButton
          size="sm"
          variant="tertiary"
          aria-label={isEnabling ? undefined : enableAriaLabel(row.description)}
          isDisabled={isDisabled}
          isPending={isEnabling}
          label={ENABLE_LABEL}
          pendingLabel={ENABLE_PENDING_LABEL}
          onPress={handleEnable}
        />
      ) : null}

      {row.decision === "ENABLED" ? (
        <Button
          size="sm"
          variant="tertiary"
          aria-label={disableAriaLabel(row.description)}
          isDisabled={isLocked}
          onPress={() => onDisable(row)}
        >
          {DISABLE_LABEL}
        </Button>
      ) : null}
    </div>
  );
}
