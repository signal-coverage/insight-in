"use client";

import { useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DataTableSort } from "@/components/DataTable";
import { BulkDeleteDialog } from "@/components/Entries/components/BulkDeleteDialog";
import { SelectionBar } from "@/components/Entries/components/SelectionBar";
import { HELP_ACTION } from "@/components/Entries/consts";
import { HELP_PATH } from "@/components/Help/consts";
import { useDeletingRows } from "@/components/Entries/useDeletingRows";
import { withPlanRows } from "@/components/Entries/utils";
import { useRowSelection } from "@/components/Entries/useRowSelection";
import { Await } from "@/components/shared/Await";
import {
  clearFilters,
  hasActiveFilters,
  serializeEntriesQuery,
  withQueryChange,
} from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import {
  deleteIncomesAction,
  setIncomeStatusAction,
} from "@/core/incomes/actions";
import { INCOMES_PATH } from "@/core/incomes/consts";
import { todayIso } from "@/core/incomes/dates";

import { CATEGORY_ACTIONS } from "./actions";
import { DeleteIncomeDialog } from "./components/DeleteIncomeDialog";
import { IncomeFormDrawer } from "./components/IncomeFormDrawer";
import { EntriesFilters } from "@/components/Entries/components/EntriesFilters";
import { EntriesPagination } from "@/components/Entries/components/EntriesPagination";
import { IncomesTable } from "./components/IncomesTable";
import { EntriesTotals } from "@/components/Entries/components/EntriesTotals";
import { ManageCategoriesDrawer } from "@/components/Entries/components/ManageCategoriesDrawer";
import { PageHeader } from "@/components/Entries/components/PageHeader";
import { RecurringFormDrawer } from "./components/RecurringFormDrawer";
import { RecurringIncomesDrawer } from "./components/RecurringIncomesDrawer";
import { RepaymentPlannerDrawer } from "./components/RepaymentPlannerDrawer";
import { RepaymentsDrawer } from "./components/RepaymentsDrawer";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_INCOME_ACTION,
  BULK_DELETE_COPY,
  CATEGORIES_COPY,
  FILTERS_COPY,
  INITIAL_FORM_TARGET,
  INITIAL_RECURRING_TARGET,
  INITIAL_REPAYMENT_PLANNER_TARGET,
  MANAGE_CATEGORIES_ACTION,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  RECURRING_ACTION,
  REPAYMENT_PLANNER_ACTION,
  REPAYMENTS_ACTION,
  TOTALS_COPY,
} from "./consts";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { useOptimisticStatus } from "@/components/Entries/useOptimisticStatus";
import type {
  FormTarget,
  IncomeRow,
  IncomesProps,
  IncomesTableData,
  RecurringFormTarget,
  RecurringRow,
} from "./types";

export function Incomes({
  today,
  query,
  totals,
  categories,
  currencies,
  table,
  recurring,
  repayments,
  reimbursables,
}: IncomesProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // The checkbox answers at once, and keeps the status it was given until the refreshed rows arrive.
  const { toggle: toggleStatus, apply: withNewStatus } = useOptimisticStatus(
    setIncomeStatusAction,
  );
  // The rows ticked, and the rows a delete is working on until the refreshed rows arrive.
  const selection = useRowSelection();
  const { deletingIds, markDeleting, deletingPlanIds, markDeletingPlan } =
    useDeletingRows();
  const formState = useOverlayState();
  const deleteState = useOverlayState();
  const bulkDeleteState = useOverlayState();
  // The ids the bulk dialog was opened with: the selection may change while it is open.
  const [bulkIds, setBulkIds] = useState<readonly string[]>([]);
  const manageCategoriesState = useOverlayState();
  const recurringState = useOverlayState();
  const recurringFormState = useOverlayState();
  const repaymentPlannerState = useOverlayState();
  // Remounts the repayment planner on every opening, so each one starts from fresh defaults.
  const [repaymentPlanner, setRepaymentPlanner] = useState(
    INITIAL_REPAYMENT_PLANNER_TARGET,
  );
  const repaymentsState = useOverlayState();
  // Remounts the month's repayments on every opening, so each one starts with no choice made.
  const [repaymentsSession, setRepaymentsSession] = useState(0);
  const [recurringTarget, setRecurringTarget] = useState<RecurringFormTarget>(
    INITIAL_RECURRING_TARGET,
  );
  const [formTarget, setFormTarget] = useState<FormTarget>(INITIAL_FORM_TARGET);
  const [incomeToDelete, setIncomeToDelete] = useState<IncomeRow | null>(null);

  const openForm = (income: IncomeRow | null) => {
    setFormTarget((current) => ({
      key: current.key + 1,
      income,
      defaultDate: todayIso(),
    }));
    formState.open();
  };

  const openRepaymentPlanner = () => {
    setRepaymentPlanner((current) => ({
      key: current.key + 1,
      defaultDate: todayIso(),
    }));
    repaymentPlannerState.open();
  };

  const openRepayments = () => {
    setRepaymentsSession((current) => current + 1);
    repaymentsState.open();
  };

  const handleHeaderAction = (key: string) => {
    if (key === ADD_INCOME_ACTION) {
      openForm(null);
    } else if (key === RECURRING_ACTION) {
      recurringState.open();
    } else if (key === REPAYMENT_PLANNER_ACTION) {
      openRepaymentPlanner();
    } else if (key === REPAYMENTS_ACTION) {
      openRepayments();
    } else if (key === MANAGE_CATEGORIES_ACTION) {
      manageCategoriesState.open();
    } else if (key === HELP_ACTION) {
      router.push(HELP_PATH);
    }
  };

  // The recurring list and its form are two drawers that never overlap: opening the form
  // hides the list, and closing the form brings the list back.
  const openRecurringForm = (template: RecurringRow | null) => {
    setRecurringTarget((current) => ({
      key: current.key + 1,
      recurring: template,
      defaultDate: todayIso(),
    }));
    recurringState.close();
    recurringFormState.open();
  };

  const handleRecurringFormOpenChange = (isOpen: boolean) => {
    recurringFormState.setOpen(isOpen);

    if (!isOpen) {
      recurringState.open();
    }
  };

  // The URL is the single source of truth for filters, sort and page: every change is a
  // navigation, so the server re-reads the list and the back button works.
  // `today` lets the serializer leave the default date range out of the URL, so the default
  // state keeps a clean address that the server resolves to the current month. The rows are about to
  // change, so what was ticked goes with them.
  const navigate = (next: EntriesQuery) => {
    selection.clear();
    startNavigation(() =>
      router.push(`${INCOMES_PATH}${serializeEntriesQuery(next, today)}`),
    );
  };

  // "Clear filters" goes back to the default state: the whole current month, with no
  // category or currency. It is only offered when the view differs from that state.
  const canClear = hasActiveFilters(query, today);
  const handleClear = () => navigate(clearFilters(query, today));

  const sort: DataTableSort = { key: query.sort, direction: query.direction };

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts
  // when the rows arrive. It also shows skeleton rows while a filter, sort or page change is
  // fetching, instead of dimming rows that no longer match. The current-month range is on by default, so an empty list only means
  // "nothing matches" when incomes exist elsewhere; with none at all, the table invites adding
  // the first one. That is why the table waits for `hasAnyIncomes` instead of guessing it.
  const renderTable = (data: IncomesTableData | null) => {
    const rows = withNewStatus(data?.rows ?? []);
    // Only the selected rows that are still on the page count.
    const selectedIds = selection.among(rows.map((row) => row.id));
    // Deleting a whole plan takes every row of it on this page with it.
    const deleting = withPlanRows(deletingIds, deletingPlanIds, rows);

    return (
      <>
        {selectedIds.size > 0 ? (
          <SelectionBar
            count={selectedIds.size}
            isDisabled={deleting.size > 0}
            onClear={selection.clear}
            onDelete={() => openBulkDelete(selectedIds)}
          />
        ) : null}

        <IncomesTable
          rows={rows}
          isLoading={data === null || isNavigating}
          isFiltered={data?.hasAnyIncomes ?? false}
          sort={sort}
          onSortChange={({ key, direction }) =>
            navigate(
              withQueryChange(query, {
                sort: key as EntriesQuery["sort"],
                direction,
              }),
            )
          }
          footer={
            data ? (
              <EntriesPagination
                {...data.pagination}
                onPageChange={(page) =>
                  navigate(withQueryChange(query, { page }))
                }
              />
            ) : undefined
          }
          onAdd={() => openForm(null)}
          onClearFilters={canClear ? handleClear : undefined}
          onEdit={openForm}
          onDelete={openDelete}
          onToggleStatus={(income, isSettled) =>
            toggleStatus(income.id, isSettled)
          }
          selectedIds={selectedIds}
          onSelectionChange={selection.select}
          deletingIds={deleting}
        />
      </>
    );
  };

  const openDelete = (income: IncomeRow) => {
    setIncomeToDelete(income);
    deleteState.open();
  };

  const openBulkDelete = (ids: ReadonlySet<string>) => {
    setBulkIds([...ids]);
    bulkDeleteState.open();
  };

  return (
    <main className={ROOT_CLASS_NAME} aria-busy={isNavigating}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actionsLabel={ACTIONS_LABEL}
        actions={ACTION_ITEMS}
        onAction={handleHeaderAction}
      />

      <EntriesTotals
        totals={totals}
        isLoading={isNavigating}
        {...TOTALS_COPY}
      />

      <EntriesFilters
        {...FILTERS_COPY}
        query={query}
        categories={categories}
        currencies={currencies}
        canClear={canClear}
        onChange={(patch) => navigate(withQueryChange(query, patch))}
        onClear={handleClear}
      />

      <Await source={table} fallback={renderTable(null)}>
        {renderTable}
      </Await>

      {/* The drawers mount once the data they list is here; until then there is nothing to show
          in them. Each waits only for its own piece. */}
      <Await source={categories} fallback={null}>
        {(loadedCategories) => (
          <>
            <Await source={reimbursables} fallback={null}>
              {(loadedReimbursables) => (
                <IncomeFormDrawer
                  isOpen={formState.isOpen}
                  onOpenChange={formState.setOpen}
                  onClose={formState.close}
                  target={formTarget}
                  categories={loadedCategories}
                  reimbursables={loadedReimbursables}
                />
              )}
            </Await>

            <RecurringFormDrawer
              isOpen={recurringFormState.isOpen}
              onOpenChange={handleRecurringFormOpenChange}
              onClose={() => handleRecurringFormOpenChange(false)}
              target={recurringTarget}
              categories={loadedCategories}
            />

            <RepaymentPlannerDrawer
              isOpen={repaymentPlannerState.isOpen}
              onOpenChange={repaymentPlannerState.setOpen}
              onClose={repaymentPlannerState.close}
              sessionKey={repaymentPlanner.key}
              defaultDate={repaymentPlanner.defaultDate}
              categories={loadedCategories}
            />

            <ManageCategoriesDrawer
              isOpen={manageCategoriesState.isOpen}
              onOpenChange={manageCategoriesState.setOpen}
              onClose={manageCategoriesState.close}
              categories={loadedCategories}
              copy={CATEGORIES_COPY}
              actions={CATEGORY_ACTIONS}
            />
          </>
        )}
      </Await>

      <Await source={recurring} fallback={null}>
        {(loadedRecurring) => (
          <RecurringIncomesDrawer
            isOpen={recurringState.isOpen}
            onOpenChange={recurringState.setOpen}
            onClose={recurringState.close}
            recurring={loadedRecurring}
            onAdd={() => openRecurringForm(null)}
            onEdit={openRecurringForm}
          />
        )}
      </Await>

      <Await source={repayments} fallback={null}>
        {(loadedRepayments) => (
          <RepaymentsDrawer
            isOpen={repaymentsState.isOpen}
            onOpenChange={repaymentsState.setOpen}
            onClose={repaymentsState.close}
            sessionKey={repaymentsSession}
            data={loadedRepayments}
          />
        )}
      </Await>

      <DeleteIncomeDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        onDeleting={markDeleting}
        onDeletingPlan={markDeletingPlan}
        income={incomeToDelete}
      />

      <BulkDeleteDialog
        isOpen={bulkDeleteState.isOpen}
        onOpenChange={bulkDeleteState.setOpen}
        onClose={bulkDeleteState.close}
        ids={bulkIds}
        copy={BULK_DELETE_COPY}
        action={deleteIncomesAction}
        onDeleting={markDeleting}
        onDeleted={selection.clear}
      />
    </main>
  );
}
