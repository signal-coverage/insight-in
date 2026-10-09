"use client";

import { useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DataTableSort } from "@/components/DataTable";
import { BulkDeleteDialog } from "@/components/Entries/components/BulkDeleteDialog";
import { EntriesFilters } from "@/components/Entries/components/EntriesFilters";
import { EntriesPagination } from "@/components/Entries/components/EntriesPagination";
import { EntriesTotals } from "@/components/Entries/components/EntriesTotals";
import { HELP_ACTION } from "@/components/Entries/consts";
import { HELP_PATH } from "@/components/Help/consts";
import { ManageCategoriesDrawer } from "@/components/Entries/components/ManageCategoriesDrawer";
import { PageHeader } from "@/components/Entries/components/PageHeader";
import { SelectionBar } from "@/components/Entries/components/SelectionBar";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { useDeletingRows } from "@/components/Entries/useDeletingRows";
import { withPlanRows } from "@/components/Entries/utils";
import { useOptimisticStatus } from "@/components/Entries/useOptimisticStatus";
import { useRowSelection } from "@/components/Entries/useRowSelection";
import { Await } from "@/components/shared/Await";
import { InlineAlert } from "@/components/shared/InlineAlert";
import {
  clearFilters,
  hasActiveFilters,
  serializeEntriesQuery,
  withQueryChange,
} from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import { EXPENSES_PATH } from "@/core/expenses/consts";
import {
  deleteExpensesAction,
  setExpenseStatusAction,
} from "@/core/expenses/actions";
import { todayIso } from "@/core/incomes/dates";

import { CATEGORY_ACTIONS } from "./actions";
import { DeleteExpenseDialog } from "./components/DeleteExpenseDialog";
import { ExpenseFormDrawer } from "./components/ExpenseFormDrawer";
import { ExpensesTable } from "./components/ExpensesTable";
import { InstallmentPlannerDrawer } from "./components/InstallmentPlannerDrawer";
import { RecurringExpensesDrawer } from "./components/RecurringExpensesDrawer";
import { RecurringNotice } from "./components/RecurringNotice";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_EXPENSE_ACTION,
  BULK_DELETE_COPY,
  CATEGORIES_COPY,
  FILTERS_COPY,
  INITIAL_FORM_TARGET,
  INITIAL_PLANNER_TARGET,
  INSTALLMENT_PLANNER_ACTION,
  MANAGE_CATEGORIES_ACTION,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  RECURRING_EXPENSES_ACTION,
  TOTALS_COPY,
} from "./consts";
import type {
  ExpenseRow,
  ExpensesProps,
  ExpensesTableData,
  FormTarget,
} from "./types";

export function Expenses({
  today,
  query,
  totals,
  categories,
  currencies,
  table,
  recurring,
  cards,
  accounts,
}: ExpensesProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  // The checkbox answers at once, and keeps the status it was given until the refreshed rows arrive.
  const {
    toggle: toggleStatus,
    apply: withNewStatus,
    refusal: statusRefusal,
  } = useOptimisticStatus(setExpenseStatusAction);
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
  // Remounts the wizard on every opening, so each one starts with no choice made.
  const [recurringSession, setRecurringSession] = useState(0);
  const plannerState = useOverlayState();
  // Remounts the planner on every opening, so each one starts from fresh defaults.
  const [planner, setPlanner] = useState(INITIAL_PLANNER_TARGET);
  const [formTarget, setFormTarget] = useState<FormTarget>(INITIAL_FORM_TARGET);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRow | null>(
    null,
  );

  const openForm = (expense: ExpenseRow | null) => {
    setFormTarget((current) => ({
      key: current.key + 1,
      expense,
      defaultDate: todayIso(),
    }));
    formState.open();
  };

  const openDelete = (expense: ExpenseRow) => {
    setExpenseToDelete(expense);
    deleteState.open();
  };

  const openBulkDelete = (ids: ReadonlySet<string>) => {
    setBulkIds([...ids]);
    bulkDeleteState.open();
  };

  const openRecurring = () => {
    setRecurringSession((current) => current + 1);
    recurringState.open();
  };

  const openPlanner = () => {
    setPlanner((current) => ({
      key: current.key + 1,
      defaultDate: todayIso(),
    }));
    plannerState.open();
  };

  const handleHeaderAction = (key: string) => {
    if (key === ADD_EXPENSE_ACTION) {
      openForm(null);
    } else if (key === MANAGE_CATEGORIES_ACTION) {
      manageCategoriesState.open();
    } else if (key === RECURRING_EXPENSES_ACTION) {
      openRecurring();
    } else if (key === INSTALLMENT_PLANNER_ACTION) {
      openPlanner();
    } else if (key === HELP_ACTION) {
      router.push(HELP_PATH);
    }
  };

  // The URL is the single source of truth for filters, sort and page: every change is a
  // navigation, so the server re-reads the list and the back button works. `today` lets the
  // serializer leave the default date range out of the URL. The rows are about to change, so what was
  // ticked goes with them.
  const navigate = (next: EntriesQuery) => {
    selection.clear();
    startNavigation(() =>
      router.push(`${EXPENSES_PATH}${serializeEntriesQuery(next, today)}`),
    );
  };

  // "Limpiar filtros" goes back to the default state: the whole current month, with no
  // category, currency or status. It is only offered when the view differs from that state.
  const canClear = hasActiveFilters(query, today);
  const handleClear = () => navigate(clearFilters(query, today));

  const sort: DataTableSort = { key: query.sort, direction: query.direction };

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts when
  // the rows arrive. It also shows skeleton rows while a filter, sort or page change is fetching.
  // With no expense at all the table invites adding the first one; that is why it waits for
  // `hasAnyExpenses` instead of guessing it.
  const renderTable = (data: ExpensesTableData | null) => {
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

        <ExpensesTable
          rows={rows}
          isLoading={data === null || isNavigating}
          isFiltered={data?.hasAnyExpenses ?? false}
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
          onToggleStatus={(expense, isSettled) =>
            toggleStatus(expense.id, isSettled)
          }
          selectedIds={selectedIds}
          onSelectionChange={selection.select}
          deletingIds={deleting}
        />
      </>
    );
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

      {/* The recurring expenses of the current month nobody has decided about yet. The notice and
          the wizard it opens come with the same data, so they wait for it together. */}
      <Await source={recurring} fallback={null}>
        {(data) => (
          <>
            <RecurringNotice
              pendingCount={data.pendingCount}
              onResolve={openRecurring}
            />

            {/* Editing a template needs the categories and the accounts too, which load on their own. */}
            <Await source={categories} fallback={null}>
              {(loadedCategories) => (
                <Await source={accounts} fallback={null}>
                  {(loadedAccounts) => (
                    <RecurringExpensesDrawer
                      isOpen={recurringState.isOpen}
                      onOpenChange={recurringState.setOpen}
                      onClose={recurringState.close}
                      sessionKey={recurringSession}
                      data={data}
                      categories={loadedCategories}
                      accounts={loadedAccounts}
                    />
                  )}
                </Await>
              )}
            </Await>
          </>
        )}
      </Await>

      {/* Why the last tick of a checkbox was refused: a debit card's account without the money. */}
      {statusRefusal ? (
        <InlineAlert variant="error">{statusRefusal}</InlineAlert>
      ) : null}

      <Await source={table} fallback={renderTable(null)}>
        {renderTable}
      </Await>

      {/* The drawers mount once the data they list is here; until then there is nothing to show in
          them. */}
      <Await source={categories} fallback={null}>
        {(loadedCategories) => (
          <>
            <Await source={cards} fallback={null}>
              {(loadedCards) => (
                <>
                  <Await source={accounts} fallback={null}>
                    {(loadedAccounts) => (
                      <>
                        <ExpenseFormDrawer
                          isOpen={formState.isOpen}
                          onOpenChange={formState.setOpen}
                          onClose={formState.close}
                          target={formTarget}
                          categories={loadedCategories}
                          cards={loadedCards}
                          accounts={loadedAccounts}
                        />

                        <InstallmentPlannerDrawer
                          isOpen={plannerState.isOpen}
                          onOpenChange={plannerState.setOpen}
                          onClose={plannerState.close}
                          sessionKey={planner.key}
                          defaultDate={planner.defaultDate}
                          categories={loadedCategories}
                          cards={loadedCards}
                          accounts={loadedAccounts}
                        />
                      </>
                    )}
                  </Await>
                </>
              )}
            </Await>

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

      <DeleteExpenseDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        onDeleting={markDeleting}
        onDeletingPlan={markDeletingPlan}
        expense={expenseToDelete}
      />

      <BulkDeleteDialog
        isOpen={bulkDeleteState.isOpen}
        onOpenChange={bulkDeleteState.setOpen}
        onClose={bulkDeleteState.close}
        ids={bulkIds}
        copy={BULK_DELETE_COPY}
        action={deleteExpensesAction}
        onDeleting={markDeleting}
        onDeleted={selection.clear}
      />
    </main>
  );
}
