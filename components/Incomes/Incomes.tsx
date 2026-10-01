"use client";

import { useOverlayState } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { DataTableSort } from "@/components/DataTable";
import { Await } from "@/components/shared/Await";
import {
  clearFilters,
  hasActiveFilters,
  serializeEntriesQuery,
  withQueryChange,
} from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import type { EntryStatus } from "@/core/entries/status";
import { setIncomeStatusAction } from "@/core/incomes/actions";
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
import {
  ACTION_ITEMS,
  ACTIONS_LABEL,
  ADD_INCOME_ACTION,
  CATEGORIES_COPY,
  FILTERS_COPY,
  INITIAL_FORM_TARGET,
  INITIAL_RECURRING_TARGET,
  MANAGE_CATEGORIES_ACTION,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  RECURRING_ACTION,
  TOTALS_COPY,
} from "./consts";
import { ROOT_CLASS_NAME } from "@/components/Entries/styles";
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
}: IncomesProps) {
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
  const recurringFormState = useOverlayState();
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

  const handleHeaderAction = (key: string) => {
    if (key === ADD_INCOME_ACTION) {
      openForm(null);
    } else if (key === RECURRING_ACTION) {
      recurringState.open();
    } else if (key === MANAGE_CATEGORIES_ACTION) {
      manageCategoriesState.open();
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
  // state keeps a clean address that the server resolves to the current month.
  const navigate = (next: EntriesQuery) =>
    startNavigation(() =>
      router.push(`${INCOMES_PATH}${serializeEntriesQuery(next, today)}`),
    );

  // "Clear filters" goes back to the default state: the current month up to today, with no
  // category or currency. It is only offered when the view differs from that state.
  const canClear = hasActiveFilters(query, today);
  const handleClear = () => navigate(clearFilters(query, today));

  const sort: DataTableSort = { key: query.sort, direction: query.direction };

  // The same table is the loading state (skeleton rows) and the loaded one, so nothing shifts
  // when the rows arrive. It also shows skeleton rows while a filter, sort or page change is
  // fetching, instead of dimming rows that no longer match. The current-month range is on by default, so an empty list only means
  // "nothing matches" when incomes exist elsewhere; with none at all, the table invites adding
  // the first one. That is why the table waits for `hasAnyIncomes` instead of guessing it.
  const renderTable = (data: IncomesTableData | null) => (
    <IncomesTable
      rows={(data?.rows ?? []).map((row) =>
        optimisticStatus[row.id]
          ? { ...row, status: optimisticStatus[row.id] }
          : row,
      )}
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

  const handleToggleStatus = (income: IncomeRow, isSettled: boolean) => {
    const status: EntryStatus = isSettled ? "SETTLED" : "PLANNED";

    setOptimisticStatus((current) => ({ ...current, [income.id]: status }));
    startStatusChange(async () => {
      await setIncomeStatusAction(income.id, status);
      setOptimisticStatus((current) => {
        const rest = { ...current };

        delete rest[income.id];

        return rest;
      });
    });
  };

  const openDelete = (income: IncomeRow) => {
    setIncomeToDelete(income);
    deleteState.open();
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
            <IncomeFormDrawer
              isOpen={formState.isOpen}
              onOpenChange={formState.setOpen}
              onClose={formState.close}
              target={formTarget}
              categories={loadedCategories}
            />

            <RecurringFormDrawer
              isOpen={recurringFormState.isOpen}
              onOpenChange={handleRecurringFormOpenChange}
              onClose={() => handleRecurringFormOpenChange(false)}
              target={recurringTarget}
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

      <DeleteIncomeDialog
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
        onClose={deleteState.close}
        income={incomeToDelete}
      />
    </main>
  );
}
