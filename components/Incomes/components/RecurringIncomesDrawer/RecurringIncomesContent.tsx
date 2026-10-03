import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, Drawer, useOverlayState } from "@heroui/react";
import { useState } from "react";

import { deleteRecurringIncomeAction } from "@/core/incomes/actions";

import {
  ADD_ICON_CLASS_NAME,
  DRAWER_DESCRIPTION_CLASS_NAME,
} from "@/components/Entries/styles";
import type { RecurringRow } from "../../types";
import { DeleteRecurringDialog } from "./components/DeleteRecurringDialog";
import { RecurringRowItem } from "./components/RecurringRow";
import {
  ADD_LABEL,
  CLOSE_LABEL,
  DESCRIPTION,
  EMPTY_HINT,
  EMPTY_TITLE,
  HEADING,
  LIST_ARIA_LABEL,
} from "./consts";
import {
  ADD_BUTTON_CLASS_NAME,
  EMPTY_CLASS_NAME,
  EMPTY_HINT_CLASS_NAME,
  EMPTY_TITLE_CLASS_NAME,
  LIST_CLASS_NAME,
} from "./styles";
import type { RecurringIncomesContentProps } from "./types";

// The list comes from the server (it refreshes after every change); only the templates just
// deleted here are hidden right away, so the drawer never shows a stale row.
export function RecurringIncomesContent({
  recurring,
  onClose,
  onAdd,
  onEdit,
}: RecurringIncomesContentProps) {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<RecurringRow | null>(null);
  const deleteState = useOverlayState();

  const items = recurring.filter((item) => !removedIds.has(item.id));

  const clearRowError = (id: string) =>
    setRowErrors((current) => {
      const next = { ...current };

      delete next[id];

      return next;
    });

  const requestDelete = (item: RecurringRow) => {
    clearRowError(item.id);
    setToDelete(item);
    deleteState.open();
  };

  const confirmDelete = async () => {
    if (!toDelete) {
      return;
    }

    const { id } = toDelete;
    const result = await deleteRecurringIncomeAction(id);

    if (result.status === "success") {
      setRemovedIds((current) => new Set(current).add(id));
    } else {
      setRowErrors((current) => ({ ...current, [id]: result.message }));
    }

    deleteState.close();
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{DESCRIPTION}</p>
      </Drawer.Header>
      <Drawer.Body>
        <Button className={ADD_BUTTON_CLASS_NAME} onPress={onAdd}>
          <PlusIcon className={ADD_ICON_CLASS_NAME} aria-hidden="true" />
          {ADD_LABEL}
        </Button>
        {items.length === 0 ? (
          <div className={EMPTY_CLASS_NAME}>
            <p className={EMPTY_TITLE_CLASS_NAME}>{EMPTY_TITLE}</p>
            <p className={EMPTY_HINT_CLASS_NAME}>{EMPTY_HINT}</p>
          </div>
        ) : (
          <ul className={LIST_CLASS_NAME} aria-label={LIST_ARIA_LABEL}>
            {items.map((item) => (
              <RecurringRowItem
                key={item.id}
                item={item}
                error={rowErrors[item.id]}
                onEdit={onEdit}
                onDelete={requestDelete}
              />
            ))}
          </ul>
        )}
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" onPress={onClose}>
          {CLOSE_LABEL}
        </Button>
      </Drawer.Footer>

      <DeleteRecurringDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        recurring={toDelete}
        onConfirm={confirmDelete}
      />
    </>
  );
}
