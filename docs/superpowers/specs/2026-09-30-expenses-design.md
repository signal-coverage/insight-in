# Expenses and entry status — design

Step 1 of the monthly budget ([project-budget-model]). Approved in chat on 2026-09-30; implementation started without a separate spec review because the user asked to proceed.

## Intent

Replace the user's Excel monthly budget. Every income and expense keeps its own currency, totals are computed per currency and never converted implicitly (conversions arrive later as their own records). The summary page, conversions, installments, the monthly recurring wizard, the month selector and the "expected incomes in the target remainder" toggle are out of scope here.

## Data

- `enum EntryStatus { PLANNED, SETTLED }`: _listado_ vs _cobrado_ (income) / _pagado_ (expense).
- `Income.status`, default `SETTLED` (existing rows keep counting as received). Incomes generated from a recurring template are created `PLANNED`.
- `Expense`: id, userId, description, amount (BigInt minor units), currency (ISO 4217), date, categoryId (Restrict), notes, status (default `SETTLED`), isRecurring (default false, only a mark for now), timestamps. Index `(userId, date desc)` and `categoryId`.
- `ExpenseCategory`: id, userId, name, unique `(userId, name)`. A user with none is seeded with Alquiler, Servicios, Comida, Transporte, Salud, Otros.

## Code

- `core/expenses` mirrors `core/incomes` (schema, service, actions, query, pageData, types, consts).
- Pieces that would be copied verbatim become shared and parameterized: category field with inline add, manage-categories drawer, pagination, totals. Incomes must behave as before (its tests guard it).
- Status toggle: a server action flips one entry's status.

## UI

- Sidebar: "Gastos" below "Ingresos". Page `/dashboard/expenses`.
- Both pages: a first table column with a checkbox that flips the status at once; a status filter next to dates, category and currency; totals per currency split into total, settled and pending; the form has a status switch (default settled).
- Expenses header menu "Acciones": "Agregar gasto", "Administrar categorías".
- Spanish UI copy, `PendingButton` for pending states, streamed loading like incomes.
