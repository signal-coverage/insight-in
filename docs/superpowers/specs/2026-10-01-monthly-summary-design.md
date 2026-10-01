# Monthly summary — design

Step 2 of the monthly budget ([project-budget-model]). Approved in chat on 2026-10-01.

## Intent

One page that shows, for a month and per currency (never converted), what came in, what went out, and what is left. Saldo previo, wallet/cash, conversions, the month selector and the settings toggle are out of scope here.

## Numbers (per currency, minor units)

- Incomes: total, settled (cobrado), pending (por cobrar).
- Expenses: total, settled (pagado), pending (por pagar).
- **Remanente actual** = settled incomes − settled expenses.
- **Remanente objetivo** = remanente actual + pending incomes − pending expenses. An option `includeExpectedIncomes` (default on) drops the pending incomes from it; the settings toggle that sets it comes later.
- A currency that only has incomes or only expenses still shows, with zero on the other side.

## Data

- `core/summary/month.ts`: `monthOf(date)`, `monthRange(month)` (first and last day), `formatMonth(month)`.
- `core/summary/compute.ts`: pure `summarize(incomeGroups, expenseGroups, options)`.
- `core/summary/service.ts`: `getMonthlySummary(userId, month)` runs two `groupBy` over (currency, status) for the month's date range, scoped by `userId`.
- The page uses the current month in Argentine time; the month is already a parameter, so the selector only has to change it.

## UI

- `/dashboard/overview`, first item of the sidebar ("Resumen"); its three placeholder children stay untouched.
- Per currency: a section with three rows of cards (incomes, expenses, remainders; the two remainders stand out).
- `components/shared/MetricCard` is the one card (a label and an amount, or a skeleton). `EntriesTotals` uses it too.
- `PageHeader` makes its Actions menu optional; the summary has none.
- Streams like the other pages: structure at once, skeleton cards while the numbers load, zero cards in ARS when the month is empty.
