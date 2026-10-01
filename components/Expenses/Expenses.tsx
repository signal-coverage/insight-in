"use client";

import { useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DataTableSort } from "@/components/DataTable";
import { EntriesFilters } from "@/components/Entries/components/EntriesFilters";
import { EntriesPagination } from "@/components/Entries/components/EntriesPagination";
import { EntriesTotals } from "@/components/Entries/components/EntriesTotals";
import { ManageCategoriesDrawer } from "@/components/Entries/components/ManageCategoriesDrawer";
import { PageHeader } from "@/components/Entries/components/PageHeader";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
import { Await } from "@/components/shared/Await";
import {
  clearFilters,
  hasActiveFilters,
  serializeEntriesQuery,
  withQueryChange,
} from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import type { EntryStatus } from "@/core/entries/status";
import { EXPENSES_PATH } from "@/core/expenses/consts";
import { setExpenseStatusAction } from "@/core/expenses/actions";
import { todayIso } from "@/core/incomes/dates";

import { CATEGORY_ACTIONS } from "./actions";
import { DeleteExpenseDialog } from "./components/DeleteExpenseDialog";
import { ExpenseFormDrawer } from "./components/ExpenseFormDrawer";
import { ExpensesTable } from "./components/ExpensesTable";
import { RecurringExpensesDrawer } from "./components/RecurringExpensesDrawer";
import { RecurringNotice } from "./components/RecurringNotice";
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_EXPENSE_ACTION,
  CATEGORIES_COPY,
  FILTERS_COPY,
  INITIAL_FORM_TARGET,
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
}: ExpensesProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [, startStatusChange] = useTransition();
  // The checkbox answers at once: the status a row was just given stays here until the server
  // has answered, then the real rows (or, if it refused, the old status) take over again.
  const [optimisticStatus, setOptimisticStatus] = useState<
    Record<string, EntryStatus>
  >({});
  const formState = useOverlayState();
  const deleteState = useOverlayState();
  const manageCategoriesState = useOverlayState();
  const recurringState = useOverlayState();
  // Remounts the wizard on every opening, so each one starts with no choice made.
  const [recurringSession, setRecurringSession] = useState(0);
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

  const openRecurring = () => {
    setRecurringSession((current) => current + 1);
    recurringState.open();
  };

  const handleHeaderAction = (key: string) => {
    if (key === ADD_EXPENSE_ACTION) {
      openForm(null);
    } else if (key === MANAGE_CATEGORIES_ACTION) {
      manageCategoriesState.open();
    } else if (key === RECURRING_EXPENSES_ACTION) {
      openRecurring();
    }
  };

  const handleToggleStatus = (expense: ExpenseRow, isSettled: boolean) => {
    const status: EntryStatus = isSettled ? "SETTLED" : "PLANNED";

    setOptimisticStatus((current) => ({ ...current, [expense.id]: status }));
    startStatusChange(async () => {
      await setExpenseStatusAction(expense.id, status);
      setOptimisticStatus((current) => {
        const rest = { ...current };

        delete rest[expense.id];

        return rest;
      });
    });
  };

  // The URL is the single source of truth for filters, sort and page: every change is a
  // navigation, so the server re-reads the list and the back button works. `today` lets the
  // serializer leave the default date range out of the URL.
  const navigate = (next: EntriesQuery) =>
    startNavigation(() =>
      router.push(`${EXPENSES_PATH}${serializeEntriesQuery(next, today)}`),
    );

  // "Limpiar filtros" goes back to the default state: the current month up to today, with no
  // category, currency or status. It is only offered when the view differs from that state.
  const canClear = hasActiveFilters(query, today);
  const handleClear = () => navigate(clearFilters(query, today));

  const sort: DataTableSort = { key: query.sort, direction: query.direction };

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts when
  // the rows arrive. It also shows skeleton rows while a filter, sort or page change is fetching.
  // With no expense at all the table invites adding the first one; that is why it waits for
  // `hasAnyExpenses` instead of guessing it.
  const renderTable = (data: ExpensesTableData | null) => (
    <ExpensesTable
      rows={(data?.rows ?? []).map((row) =>
        optimisticStatus[row.id]
          ? { ...row, status: optimisticStatus[row.id] }
          : row,
      )}
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
            onPageChange={(page) => navigate(withQueryChange(query, { page }))}
          />
        ) : undefined
      }
      onAdd={() => openForm(null)}
      onClearFilters={canClear ? handleClear : undefined}
      onEdit={openForm}
      onDelete={openDelete}
      onToggleStatus={handleToggleStatus}
    />
  );

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

            <RecurringExpensesDrawer
              isOpen={recurringState.isOpen}
              onOpenChange={recurringState.setOpen}
              onClose={recurringState.close}
              sessionKey={recurringSession}
              data={data}
            />
          </>
        )}
      </Await>

      <Await source={table} fallback={renderTable(null)}>
        {renderTable}
      </Await>

      {/* The drawers mount once the data they list is here; until then there is nothing to show in
          them. */}
      <Await source={categories} fallback={null}>
        {(loadedCategories) => (
          <>
            <ExpenseFormDrawer
              isOpen={formState.isOpen}
              onOpenChange={formState.setOpen}
              onClose={formState.close}
              target={formTarget}
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

      <DeleteExpenseDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        expense={expenseToDelete}
      />
    </main>
  );
}
