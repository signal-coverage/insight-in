"use client";

import { useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BulkDeleteDialog } from "@/components/Entries/components/BulkDeleteDialog";
import { PageHeader } from "@/components/Entries/components/PageHeader";
import { SelectionBar } from "@/components/Entries/components/SelectionBar";
import { HELP_ACTION } from "@/components/Entries/consts";
import { HELP_PATH } from "@/components/Help/consts";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { useDeletingRows } from "@/components/Entries/useDeletingRows";
import { useRowSelection } from "@/components/Entries/useRowSelection";
import { Await } from "@/components/shared/Await";
import { deleteCardsAction } from "@/core/cards/actions";

import { CardFormDrawer } from "./components/CardFormDrawer";
import { CardsTable } from "./components/CardsTable";
import { DeleteCardDialog } from "./components/DeleteCardDialog";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_CARD_ACTION,
  BULK_DELETE_COPY,
  INITIAL_FORM_TARGET,
  LIMIT_NOTE,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import { NOTE_CLASS_NAME } from "./styles";
import type { CardRow, CardsProps, CardsTableData, FormTarget } from "./types";

export function Cards({ table, banks }: CardsProps) {
  const router = useRouter();
  // The rows ticked, and the rows a delete is working on until the refreshed rows arrive.
  const selection = useRowSelection();
  const { deletingIds, markDeleting } = useDeletingRows();
  const formState = useOverlayState();
  const deleteState = useOverlayState();
  const bulkDeleteState = useOverlayState();
  // The ids the bulk dialog was opened with: the selection may change while it is open.
  const [bulkIds, setBulkIds] = useState<readonly string[]>([]);
  const [formTarget, setFormTarget] = useState<FormTarget>(INITIAL_FORM_TARGET);
  const [cardToDelete, setCardToDelete] = useState<CardRow | null>(null);

  const openForm = (card: CardRow | null) => {
    setFormTarget((current) => ({ key: current.key + 1, card }));
    formState.open();
  };

  const openDelete = (card: CardRow) => {
    setCardToDelete(card);
    deleteState.open();
  };

  const openBulkDelete = (ids: ReadonlySet<string>) => {
    setBulkIds([...ids]);
    bulkDeleteState.open();
  };

  const handleHeaderAction = (key: string) => {
    if (key === ADD_CARD_ACTION) {
      openForm(null);
    } else if (key === HELP_ACTION) {
      router.push(HELP_PATH);
    }
  };

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts when
  // the rows arrive. The note about the cap only makes sense once there are cards to read it by.
  const renderTable = (data: CardsTableData | null) => {
    const rows = data?.rows ?? [];
    // Only the selected rows that are still in the list count.
    const selectedIds = selection.among(rows.map((row) => row.id));

    return (
      <>
        {selectedIds.size > 0 ? (
          <SelectionBar
            count={selectedIds.size}
            isDisabled={deletingIds.size > 0}
            onClear={selection.clear}
            onDelete={() => openBulkDelete(selectedIds)}
          />
        ) : null}

        <CardsTable
          rows={rows}
          isLoading={data === null}
          onAdd={() => openForm(null)}
          onEdit={openForm}
          onDelete={openDelete}
          selectedIds={selectedIds}
          onSelectionChange={selection.select}
          deletingIds={deletingIds}
        />
        {data && data.rows.length > 0 ? (
          <p className={NOTE_CLASS_NAME}>{LIMIT_NOTE}</p>
        ) : null}
      </>
    );
  };

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actionsLabel={ACTIONS_LABEL}
        actions={ACTION_ITEMS}
        onAction={handleHeaderAction}
      />

      <Await source={table} fallback={renderTable(null)}>
        {renderTable}
      </Await>

      {/* The form mounts once the banks it offers are here. */}
      <Await source={banks} fallback={null}>
        {(loadedBanks) => (
          <CardFormDrawer
            isOpen={formState.isOpen}
            onOpenChange={formState.setOpen}
            onClose={formState.close}
            target={formTarget}
            banks={loadedBanks}
          />
        )}
      </Await>

      <DeleteCardDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        onDeleting={markDeleting}
        card={cardToDelete}
      />

      <BulkDeleteDialog
        isOpen={bulkDeleteState.isOpen}
        onOpenChange={bulkDeleteState.setOpen}
        onClose={bulkDeleteState.close}
        ids={bulkIds}
        copy={BULK_DELETE_COPY}
        action={deleteCardsAction}
        onDeleting={markDeleting}
        onDeleted={selection.clear}
      />
    </main>
  );
}
