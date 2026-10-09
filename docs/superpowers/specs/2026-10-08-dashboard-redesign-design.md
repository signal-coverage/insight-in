# Dashboard redesign: the Resumen > General page (design)

Status: design approved by the user in conversation on 2026-10-08; this file is the written spec awaiting review.
Builds on: the summary, banks, transfers, cards and crypto stages (all implemented). It reorganises `/dashboard/overview` and ADDS attention items and charts. It changes no stored data and needs no migration.

## Purpose

The user wants "exactly what the summary has today", better organised, plus charts and a place that points at things that need attention. Decisions from the conversation:

- Everything the page shows today stays: the month selector, the "Saldo inicial" (opening balances) drawer, the "Sumar ingresos por cobrar" switch, and for each currency Ingresos (Total, Cobrado, Por cobrar, Reintegros pendientes), Gastos (Total, Pagado, Por pagar) and Remanentes (Saldo previo, Actual, Objetivo).
- **"Por cuenta" (the per-account balances) moves to the very top.** It shows today's balances, whatever month is being viewed.
- New: a **"Requiere atención"** block and **three charts**.
- Currencies are never added together, in totals or in charts.

Success: the user lands on the page, sees what they hold today per account, anything that needs action, then the month in detail for one currency at a time, with charts, and every figure that exists today is still reachable and unchanged.

## Facts checked in the repo (2026-10-08)

- `components/Summary` has `Summary.tsx`, `CurrencySection`, `AccountsSection` ("Por cuenta"), `MonthSelector`, `ExpectedIncomesSwitch`, `OpeningBalanceDrawer`, `LoadingSummary`, `CardRow`. `core/summary` has `service.ts` (`getMonthlySummary`), `byAccount.ts`, `groupAccounts.ts`, `compute.ts`. Page loader: `app/dashboard/overview/loadSummaryView.ts`.
- No chart library is installed (`package.json`). Charts are plain SVG/HTML components (decision below). The visualisation guidance used: pick the form by the data's job, one axis, no dual axis, thin marks, a legend for two or more series, tooltips on hover, a table view for accessibility, colours from the theme (the app has 13 selectable themes and never uses blue buttons).
- Entries have a date, a status (PLANNED, SETTLED, COVERED), a currency, a category and an account; cards have closing/due days and per-currency limits (`core/cards`); reimbursements and expected incomes already feed the summary.

## Decisions

1. **Page order, top to bottom:** (a) "Por cuenta", today's balances; (b) "Requiere atención", only when there is something; (c) the month block: heading with the month selector, "Saldo inicial" and the expected-incomes switch, then currency tabs, then Ingresos / Gastos / Remanentes, then the charts.
2. **The month selector only governs block (c).** "Por cuenta" and "Requiere atención" look at today (and the next days), not the chosen month.
3. **One currency at a time, with tabs** in the month block (ARS first by default, then the others in the app's currency order: legal tender then crypto). The selected currency is kept in the address (`?currency=USD`) so a link shows the same view; a currency without activity in the month is still a tab if the user has an account in it. This replaces today's stacked per-currency sections; the figures inside are unchanged.
4. **Per-currency block = three columns:** Ingresos (Total, Cobrado, Por cobrar, Reintegros pendientes), Gastos (Total, Pagado, Por pagar, with a paid-over-total progress bar), Remanentes (Saldo previo, Actual, Objetivo). Same numbers and same formulas as today (`getMonthlySummary` unchanged).
5. **"Requiere atención" items** (each with a button to resolve it, shown only when it applies):
   - planned expenses overdue or due within the next 7 days (installments and card charges included; the date is the one the app already shows for the expense);
   - planned incomes overdue, and pending reimbursements;
   - accounts with a negative balance;
   - credit cards at or above their warning threshold of the limit (the existing "near" rule of the recommender, `NEAR_LIMIT_PERCENT`).
     Items are grouped by kind, most urgent first; each says what and how much in the item's own currency. The block is hidden when empty and never invents items.
6. **Three charts, per selected currency, no cross-currency mixing:**
   - income against expenses of the last 6 months (grouped bars);
   - expenses by category of the viewed month (horizontal bars sorted descending, top categories plus "Otras", not a pie);
   - balance through the viewed month, one point per day (a line). This chart needs the daily balance; it is built only if it can be computed from the existing flows with one cheap query set per request. If the plan finds it too costly it moves to Deferred and the page ships with two charts.
7. **Charts are plain SVG components in the repo** (no new dependency), coloured with the active theme's tokens, thin marks, direct labels where few, a hover tooltip, and a "ver como tabla" toggle so the same numbers are available as text. Negative values and overdue items use the danger colour; income and expense use two theme colours that stay distinguishable without colour alone (label and legend).
8. **No data model change, no migration.** New read functions in `core/summary` (attention items, monthly series, category breakdown, daily balance) scoped by the session user; money stays minor units and formats through `formatMoney`.
9. **Sidebar reorganisation is NOT part of this stage.** The unimplemented entries (Proyecto, Facturación, Cobros, Calendario, Facturas) and the ordering of the sidebar are a separate follow-up.

## Behaviour and screens (Spanish es-AR voseo; code in English)

- **Por cuenta:** the existing card per currency, compacted: banks as groups, accounts as lines, a total per currency, negatives in red; empty currencies compact; works on a phone width.
- **Requiere atención:** a card with a short list; each line has the amount, what it is, when, and a link button ("Ver gastos", "Ver Bancos", "Ver Tarjetas", "Ver ingresos") that lands on the right page with the right filter when one exists (e.g. expenses with status pending). Empty state: the block is not rendered.
- **Month block:** the month selector heading, the existing "Saldo inicial" and "Sumar ingresos por cobrar" controls kept with their current copy, currency tabs, the three columns, the charts under them. On narrow screens the three columns stack and the tabs scroll.
- **Loading:** each block streams in behind its own skeleton (the page already streams its data); an error in the attention block or the charts must not take the page down (they degrade to "No pudimos cargar esto" with a retry link).
- Visual direction: the app's own themes and HeroUI components; one memorable element only (the per-account balances at the top); no gradient decoration, no all-caps eyebrow labels, no identical-card grid look beyond what the data needs.

## Errors and edge cases

A user with no accounts, no entries in the month, a month with only crypto, a currency with a negative total, 12+ categories, a single month of history for the 6-month chart (shows the months it has), a viewed month in the future (planned items only), and a very long account or category name (truncate with title) all render sensibly. The currency in the address that the user does not have falls back to the default tab.

## Testing

Strict TDD with Vitest. Pure functions for each new calculation (attention items, 6-month series, category breakdown with "Otras", daily balance) with edge cases above; services against the Prisma mock; components rendered with fixtures (tabs, chart tooltips and table view, attention links, empty states); the existing summary tests keep passing (figures unchanged: add a regression test that the per-currency numbers equal today's); the loader streams and isolates failures per block; the component-structure guard; a browser pass on the real data (read-only: no writes needed) at desktop and phone widths, checking the order, the tabs, the numbers against the previous page, and the charts.

## Out of scope

The sidebar reorganisation, the not-yet-implemented sections, forecasts or recommendations beyond the attention items, comparing months, budgets per category, exporting, any change to how balances or totals are calculated, and charts mixing currencies.

## Open items to settle in the plan

- Where each attention rule reads its dates (expense date versus card charge date) and which filter each "Ver" link can carry on the target pages.
- The cost of the daily balance series (one grouped query per source versus per-day reads) and the decision to ship the line chart or defer it.
- How the currency tabs interact with the summary's existing per-currency toggle for expected incomes.
