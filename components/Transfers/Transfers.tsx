"use client";

import { useOverlayState } from "@heroui/react";
import { useState } from "react";

import { BulkDeleteDialog } from "@/components/Entries/components/BulkDeleteDialog";
import { PageHeader } from "@/components/Entries/components/PageHeader";
import { SelectionBar } from "@/components/Entries/components/SelectionBar";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { useDeletingRows } from "@/components/Entries/useDeletingRows";
import { useRowSelection } from "@/components/Entries/useRowSelection";
import { Await } from "@/components/shared/Await";
import { MonthSelector } from "@/components/Summary/components/MonthSelector";
import { todayIso } from "@/core/incomes/dates";
import { deleteTransfersAction } from "@/core/transfers/actions";
import { TRANSFERS_PATH } from "@/core/transfers/consts";

import { DeleteTransferDialog } from "./components/DeleteTransferDialog";
import { TransferFormDrawer } from "./components/TransferFormDrawer";
import { TransfersFilters } from "./components/TransfersFilters";
import { TransfersTable } from "./components/TransfersTable";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_TRANSFER_ACTION,
  BULK_DELETE_COPY,
  INITIAL_FORM_TARGET,
  NO_FILTERS,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import type {
  FormTarget,
  TransferFilters,
  TransferRow,
  TransfersProps,
  TransfersTableData,
} from "./types";
import { filterTransfers, hasActiveFilters } from "./utils";

export function Transfers({
  month,
  currentMonth,
  monthLabel,
  table,
  accounts,
}: TransfersProps) {
  // The rows ticked, and the rows a delete is working on until the refreshed rows arrive.
  const selection = useRowSelection();
  const { deletingIds, markDeleting } = useDeletingRows();
  const formState = useOverlayState();
  const deleteState = useOverlayState();
  const bulkDeleteState = useOverlayState();
  // The ids the bulk dialog was opened with: the selection may change while it is open.
  const [bulkIds, setBulkIds] = useState<readonly string[]>([]);
  const [formTarget, setFormTarget] = useState<FormTarget>(INITIAL_FORM_TARGET);
  const [transferToDelete, setTransferToDelete] = useState<TransferRow | null>(
    null,
  );
  const [filters, setFilters] = useState<TransferFilters>(NO_FILTERS);

  const openForm = (transfer: TransferRow | null) => {
    setFormTarget((current) => ({
      key: current.key + 1,
      transfer,
      defaultDate: todayIso(),
    }));
    formState.open();
  };

  const openDelete = (transfer: TransferRow) => {
    setTransferToDelete(transfer);
    deleteState.open();
  };

  const openBulkDelete = (ids: ReadonlySet<string>) => {
    setBulkIds([...ids]);
    bulkDeleteState.open();
  };

  const handleHeaderAction = (key: string) => {
    if (key === ADD_TRANSFER_ACTION) {
      openForm(null);
    }
  };

  const canClear = hasActiveFilters(filters);
  const clearFilters = () => setFilters(NO_FILTERS);

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts when the
  // rows arrive. The filters narrow the month's rows on the client.
  const renderTable = (data: TransfersTableData | null) => {
    const rows = filterTransfers(data?.rows ?? [], filters);
    // Only the selected rows that are still shown count.
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

        <TransfersTable
          rows={rows}
          isLoading={data === null}
          isFiltered={canClear}
          onAdd={() => openForm(null)}
          onClearFilters={canClear ? clearFilters : undefined}
          onEdit={openForm}
          onDelete={openDelete}
          selectedIds={selectedIds}
          onSelectionChange={selection.select}
          deletingIds={deletingIds}
        />
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
        aside={
          <MonthSelector
            month={month}
            label={monthLabel}
            currentMonth={currentMonth}
            basePath={TRANSFERS_PATH}
          />
        }
      />

      <TransfersFilters
        filters={filters}
        accounts={accounts}
        canClear={canClear}
        onChange={(patch) =>
          setFilters((current) => ({ ...current, ...patch }))
        }
        onClear={clearFilters}
      />

      {/* Keyed by the month: another month is another list, so it gets a fresh boundary that shows
          the loading rows at once, instead of keeping the previous month's rows under the new name. */}
      <Await key={month} source={table} fallback={renderTable(null)}>
        {renderTable}
      </Await>

      {/* The form mounts once the accounts it offers are here; until then there is nothing to show in it. */}
      <Await source={accounts} fallback={null}>
        {(loadedAccounts) => (
          <TransferFormDrawer
            isOpen={formState.isOpen}
            onOpenChange={formState.setOpen}
            onClose={formState.close}
            target={formTarget}
            accounts={loadedAccounts}
          />
        )}
      </Await>

      <DeleteTransferDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        onDeleting={markDeleting}
        transfer={transferToDelete}
      />

      <BulkDeleteDialog
        isOpen={bulkDeleteState.isOpen}
        onOpenChange={bulkDeleteState.setOpen}
        onClose={bulkDeleteState.close}
        ids={bulkIds}
        copy={BULK_DELETE_COPY}
        action={deleteTransfersAction}
        onDeleting={markDeleting}
        onDeleted={selection.clear}
      />
    </main>
  );
}
