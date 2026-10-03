import { FunnelIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";

import { FILTERED_ACTION_LABEL } from "./consts";
import {
  ACTION_ICON_CLASS_NAME,
  HINT_CLASS_NAME,
  ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { EntriesEmptyStateProps } from "./types";

// DataTable renders `emptyState` unwrapped, so this component carries its own bordered
// box and fills whatever space its parent leaves.
export function EntriesEmptyState({
  variant,
  copy,
  onAction,
}: EntriesEmptyStateProps) {
  // `ActionIcon` is only set where the button creates something ("Agregar ingreso" gets the same
  // "+" as the other add actions); "Limpiar filtros" adds nothing, so it has none.
  const { Icon, ActionIcon, title, hint, action } =
    variant === "empty"
      ? { Icon: copy.empty.icon, ActionIcon: PlusIcon, ...copy.empty }
      : {
          Icon: FunnelIcon,
          ActionIcon: null,
          ...copy.filtered,
          action: FILTERED_ACTION_LABEL,
        };

  return (
    <div className={ROOT_CLASS_NAME}>
      <Icon className={ICON_CLASS_NAME} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className={TITLE_CLASS_NAME}>{title}</p>
        <p className={HINT_CLASS_NAME}>{hint}</p>
      </div>
      {onAction ? (
        <Button size="sm" onPress={onAction}>
          {ActionIcon ? (
            <ActionIcon className={ACTION_ICON_CLASS_NAME} aria-hidden="true" />
          ) : null}
          {action}
        </Button>
      ) : null}
    </div>
  );
}
