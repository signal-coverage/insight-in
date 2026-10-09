# Dashboard Redesign: Resumen > General — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard/overview` keeps every figure and control it has today and is reorganised top to bottom: "Por cuenta" (today's balances), a new "Requiere atención" block (only when something needs action), then the month block: a heading with the month selector, "Saldo inicial" and "Sumar ingresos por cobrar", one tab per currency (`?currency=USD`), the Ingresos / Gastos / Remanentes columns of that currency (the same numbers, plus a paid-over-total bar under Gastos), and three charts of that currency (income against expenses of the last 6 months, expenses by category of the month, the balance day by day). Currencies are never added together. No data model change.

**Architecture:** New pure functions in `core/summary` (`days.ts`, `series.ts`, `attention.ts`, `tabs.ts`) compute the 6-month series, the category breakdown with "Otras", the daily balance and the attention items over rows that are already read. Two new read modules scoped by `userId` feed them: `core/summary/charts.ts` (`readMonthChartSources`: four grouped queries, run together) and `core/summary/attentionSources.ts` (`readAttentionSources`: planned expenses and incomes, plus the existing `listReimbursableExpenses` and `listCards`). `getMonthlySummary` is untouched. The page loader `app/dashboard/overview/loadSummaryView.ts` keeps its promises and adds two that never reject (`attention` and `charts`, each a `BlockResult`: `{ status: "ok", value } | { status: "error" }`), so a failing block degrades to "No pudimos cargar esto." without taking the page down; `summary` now carries one row per tab currency (summary currencies plus the currencies the user holds an account in, ARS first). The UI gets plain SVG/HTML chart components (no new dependency) under `components/Summary/components/Charts`, an `AttentionSection`, a `BlockError`, and a `MonthSection` that owns the selected currency (client state mirrored into the address with `window.history.replaceState`, so a tab change never refetches) and renders HeroUI `Tabs` through `CurrencyPanels`. `Summary.tsx` swaps its composition last.

**Tech Stack:** Next.js 16.3.6 (App Router, server components streaming promises to client components), React 19.2, TypeScript, Prisma 7.10 + Neon, HeroUI v3 (`@heroui/react`: Tabs, Card, ProgressBar, Skeleton, Link, Button), Tailwind 4, Vitest 4 + Testing Library (jsdom per file), Clerk.

**Spec:** docs/superpowers/specs/2026-10-08-dashboard-redesign-design.md (all sections; its three "Open items to settle in the plan" are settled in D1, D5 and D9 below). Builds on the summary, banks, transfers, cards and crypto stages (all done and applied). It adds no migration.

## Decisions taken

The spec is silent, ambiguous or in tension with the code on these; each one is the safest default. The user may veto any of them before or during the build.

- **D1 (spec open item 1) The dates the attention rules read.** Every expense is read by its `date`, the one the app already shows: for a card purchase and for an installment `date` is already the day the statement is paid (schema comment on `Expense.purchaseDate`: "`date` stays the day the card statement is paid (the charge)"), so no rule reads `purchaseDate`. Overdue expense: `PLANNED` and `date < today`. Upcoming expense: `PLANNED` and `today <= date <= today + 7` (both ends included). Planned income: only overdue (`PLANNED` and `date < today`); one dated today is not overdue yet. Pending reimbursements: every expense with something outstanding, whatever its date (the existing `listReimbursableExpenses`, which already leaves out the fully paid back). Negative accounts: every account of "Por cuenta" below zero (an archived one included: "Por cuenta" shows it while it holds money). Credit cards: every cap whose existing tier (`tierOf`, `NEAR_LIMIT_PERCENT` = 80) is `"near"` or `"exceeded"`, measured in today's month (the Cards page's own figure). The existing rule is "more than 80%", so a cap used at exactly 80% is not listed; the spec's "at or above" is read as "the existing near rule", which it names. Veto option: `>= 80%`.
- **D2 The "Ver" links and their filters.** Expenses (overdue and upcoming): `/dashboard/expenses?to=<today+7>&status=PLANNED` (`parseEntriesQuery` reads `to` and `status`; a URL with a `to` and no `from` means "no lower date", so the overdue ones of earlier months are listed too). Overdue incomes: `/dashboard/incomes?to=<yesterday>&status=PLANNED`. Pending reimbursements: plain `/dashboard/incomes` (no filter exists for them; that is where the income that pays an expense back is registered). Negative accounts: plain `/dashboard/banks`. Cards: plain `/dashboard/cards`. Labels: "Ver gastos", "Ver ingresos", "Ver Bancos", "Ver Tarjetas" (as the spec writes them). A link belongs to the group, not to each line, and carries no currency.
- **D3 Order and size of the attention block.** Groups in this order (most urgent kind first): overdue expenses, negative accounts, cards near or over their cap, upcoming expenses, overdue incomes, pending reimbursements. Inside a group: entries and reimbursements oldest date first (ties by id); accounts by currency order then lowest balance first; card caps over the cap first, then the fullest. At most 5 lines per group, then "y N más". Severity: overdue expenses, overdue incomes, negative accounts and caps over the cap use the danger colour on the amount; the others keep the plain text colour (never colour alone: the group title says what it is).
- **D4 The 6-month chart.** Each month's bars are that month's Ingresos "Total" and Gastos "Total" (PLANNED + SETTLED, never COVERED), so the bar of the viewed month equals the figures above it. The six months end with the viewed month. Per currency, the months before its first month with anything are left out (a user with one month of history sees one month); an empty month in between shows at zero.
- **D5 (spec open item 2) The daily balance ships.** It costs no extra query per day: the 6-month read groups by `currency, date, status`, so the viewed month's settled flows come with it, and the start is the summary's own "Saldo previo". The chart read is four grouped queries in total (incomes and expenses by day for 6 months, the month's expenses by category, the user's category names), run together. Rules: settled money only (planned money never moves a balance), one point per day from the 1st to the last day of a past month, up to today in the month in course, and none for a month that has not started (the chart shows "El mes todavía no empezó: no hay saldos para mostrar."). For a past month the last point equals "Actual".
- **D6 The category chart.** The viewed month's expenses PLANNED + SETTLED per category (so the bars add up to Gastos "Total"), largest first (ties by name, es-AR). With 8 or more categories the first 6 stay and the rest fold into "Otras"; 7 categories are shown as they are ("Otras" for a single category would hide its name). Horizontal HTML bars, never a pie.
- **D7 Currency tabs.** The tabs are the union of the currencies of the month's summary and the currencies of "Por cuenta" (an account held today), ARS first, then the others with `compareCurrencyCodes` (legal tender by code, then crypto in registry order). With no currency at all the month block shows one ARS tab at zero (today's `EMPTY_ROWS`). Every currency's numbers and charts reach the client in the one load, so a tab change is client state only: the address is updated with `window.history.replaceState` (Next.js integrates it with the router, see `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API"), with no server round trip. ARS (the default) is left out of the address; any other tab writes `?currency=CODE` after `month`. A `currency` the user has no tab for falls back to the first tab. Changing the month keeps the chosen currency in the new address. If the "Por cuenta" read fails, the tabs are the summary's currencies only.
- **D8 Failure isolation.** There is no `error.tsx` under `app/dashboard`, so isolation lives in the loader: `attention` and `charts` are `BlockResult` promises that never reject; the page renders `BlockError` ("No pudimos cargar esto." and a "Reintentar" link to the same address, a plain reload) in their place. `accountBalances` keeps today's rule (an empty list when it fails). `summary`, `includeExpectedIncomes` and `openingBalance` keep today's behaviour unchanged (the existing tests pin it).
- **D9 (spec open item 3) The expected incomes switch.** There is no per-currency toggle in the code: "Sumar ingresos por cobrar" is one user setting (`UserSettings.includeExpectedIncomes`) that changes the "Objetivo" of every currency. It stays one switch, with its current copy, in the month block under the heading, above the tabs, and applies to every tab. Saving it revalidates the page, which keeps the tab because the tab is in the address.
- **D10 The header.** `PageHeader` keeps the title "Resumen" and its description, with no `aside`. The month block has its own heading, "El mes en detalle" (h2), with "Saldo inicial" and the month selector beside it; the selector still names the month ("Septiembre de 2026").
- **D11 The paid bar.** Under the Gastos column: a HeroUI `ProgressBar` named "Pagado del total en ARS" whose value is `round(settled × 100 / total)`, 0 when the total is 0, capped to 0..100, with the text "60 % pagado" beside it (the number is never colour-only).
- **D12 Chart look and access.** Monthly bars and the daily line are SVG; category bars are HTML. Colours from theme tokens only: incomes `success`, expenses `warning`, "Otras" `muted`, a negative balance `danger`, axes and grid `border`/`muted`; text keeps the text tokens. Each monthly group is focusable (Tab) and opens the tooltip on hover and focus; each category row the same; the daily line is one focusable SVG walked with the arrow keys (Escape closes the tooltip). Every chart has "Ver como tabla" / "Ver como gráfico", a legend only when it has two series (the monthly one), and direct labels for few marks (month names; the daily maximum, minimum and last day as text under the line).
- **D13 "Por cuenta" compacted.** It already is one card per currency with banks as groups, accounts as lines, a total per currency and negatives in red. This stage moves it to the top and gives a long account name its full text as a `title` (it already truncates); nothing else changes.

## Global Constraints

- Copy language: all UI copy (labels, buttons, errors, empty states, hints) in Spanish es-AR, neutral/professional, voseo as in Cards/Roadmap/Banks ("Usá las flechas", "Lo que esperás"). Code, identifiers, comments and tests in English. Route slugs stay English (`/dashboard/overview`).
- Component layout is enforced by `components/componentStructure.test.ts` (scans `components/` and `app/`, `.tsx` files that are not tests): no `type`/`interface`/`enum` declarations in a component file, no `const`/helper function at column 0 (only the component itself), exactly one component per file, no props typed inline (`}: {`), no inline `className="..."` of 40+ characters (move it to `styles.ts`), a sub-component is never a bare file under a nested `components/` folder (it gets its own folder `Name/Name.tsx` plus `index.ts`). Types go in `types.ts`, constants in `consts.ts`, styles in `styles.ts`, helpers in `utils.ts`, hooks in `useX.ts`.
- Strict TDD with Vitest: every behaviour gets a failing test first; run it and see it fail for the stated reason before writing the implementation (RED), then see it pass (GREEN). A test that pins behaviour another task already delivered (a characterization) is marked as such and expected to pass at once. Component tests start with `// @vitest-environment jsdom`. Unit tests never need the database: reads are tested against the Prisma mock (`vi.mock("@/infrastructure/db/client", …)`), exactly like `core/summary/service.test.ts`.
- Tests that cannot fail are defects: every negative assertion (`not.toHaveBeenCalled`, `toBeNull`, `queryBy… not in the document`, `not.toContain`) has a positive twin in the same `describe` that proves the thing does happen in the other case; never a loop that asserts nothing when its list is empty (assert the length first); BigInt literals (`5000n`) do not compile (target ES2017): always `BigInt(5000)`; never index a typed mock tuple beyond its length; Tabs are queried by role and accessible name (`getByRole("tab", { name: "USD" })`), the tab list by its name ("Moneda"); a HeroUI `Select` trigger's accessible name is "<value or placeholder> <label>" (none is added in this stage); a currency query must not match a crypto code by accident (`{ name: "USD" }` is exact; never `/USD/`, which also matches "USDC"). Never delete a test of unchanged behaviour when editing a test file; every moved or changed test is listed in its task.
- Money convention: minor units, `BigInt` in the database, `number` in the app (`minorUnitsToNumber` at the boundary); money is formatted on the server with `formatMoney(minorUnits, currency)` (`core/incomes/money.ts`, es-AR), the client only places text and uses the plain numbers for geometry. Amounts in different currencies are never added, not in totals, not in charts, not in the attention block. `Intl.NumberFormat` is never given a crypto code: every amount label, chart labels included, goes through `formatMoney`.
- Balance rule (binding): `balance(account, date) = opening (if the opening month has started) + settled incomes − settled expenses − transfers out + transfers in`. `PLANNED` and `COVERED` entries never move money. Transfers move money between accounts of one currency, so a currency's total (and the daily line) never changes with them.
- No change to how any existing figure is computed: `getMonthlySummary`, `summarize`, `previousBalances`, `readAccountBalances`, `listAccountBalanceRows`, `groupAccountBalances`, `usageOf`, `tierOf` and `listReimbursableExpenses` are consumed, never edited.
- Every read is scoped by the Clerk `userId` that comes from the session (`requireUserId()` in the page), never from client input; `userId` leads every `where`.
- Colors: never blue buttons; only theme tokens (`text-muted`, `text-danger`, `bg-surface-secondary`, `ring-border`, `fill-success`, `fill-warning`, `bg-muted`, …), which follow the 13 themes in `app/globals.css`. Async buttons use `PendingButton` (guard `components/shared/PendingButton/pendingButtonUsage.test.ts`). This stage adds no async button (the "Ver como tabla" toggle is synchronous).
- Next.js (this repo runs 16.3.6, see AGENTS.md: it differs from what you remember): pages are async Server Components that call `requireUserId()` (guard `lib/auth/routeProtection.test.ts`); `searchParams` is a promise; promises handed to client components are created once per request in the loader. Before writing Task 6 read `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` (section "Native History API").
- HeroUI v3 differs from what you remember (AGENTS.md: "STOP. What you remember about HeroUI React v3 is WRONG for this project"). Every UI task starts by reading the HeroUI docs it uses under `C:\Users\Nico\Desktop\insight-in\.heroui-docs\react\components\` (named in each task) and then copies the markup of the components that already work in this repo (named in each task). If `.heroui-docs` is missing, run `heroui agents-md --react --output AGENTS.md` first.
- Charts (binding, from the spec and the dataviz method): plain SVG/HTML components in the repo, no new dependency (`package.json` is not touched); one axis, never a dual axis; thin marks; a legend for two or more series and none for one; direct labels where few; a hover and focus tooltip; a "Ver como tabla" view with the same numbers; keyboard-accessible; colours from theme tokens; never colour alone.
- Database: this stage adds NO migration and runs NO Prisma command of any kind (no `prisma generate`, `validate`, `format`, `migrate`, `db`, `studio`), and no `npm install`/`npm update`. No test may need the database. The browser pass is read-only.
- Do not start, stop or restart `next dev`, and do not close the Playwright browser. No git commit/add/stash steps anywhere: the user commits only when asked; the snapshot is taken by the controller.
- Use Read/Glob/Grep or `rg` to look at files (never `cat`/`grep`/`find`/`ls` in a shell).
- Every task ends with a verify step that runs, in this order: that task's tests, `npx vitest run` (the whole suite), `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, and `npx prettier --check --end-of-line auto <the files the task created or changed>` (never `npm run format`: it rewrites the whole repo; some files are CRLF, hence `--end-of-line auto`). If the check fails, format exactly those files with `npx prettier --write --end-of-line auto <files>` and re-run the check. A task boundary is only reached with all of them green.

## Review Focus

The inputs and conditions the spec implies but no obvious test exercises, the ones most likely to bite a person using this, most likely first. Each one is pinned by a test in the task named at the end of the line.

1. **A figure that silently changes in the reorganisation.** The tabs add zero rows, the loader re-plumbs the summary promise and the columns re-lay the cards: any of them could drop, reorder or recompute a number. The rows of every currency the summary computed must be exactly `toSummaryRows(getMonthlySummary(...))`, a zero row only appears for a currency held in an account, and the chart of the viewed month must agree with the figures above it (bars = Ingresos/Gastos "Total", categories add up to Gastos "Total", the daily line ends at "Actual" for a past month). Pinned in Task 1 (`tabs.test.ts` "keeps every row … untouched", `series.test.ts` "agrees with the month's figures"), Task 3 (`loadSummaryView.test.ts` "keeps every figure of a currency exactly as the month's summary computes it", `utils.test.ts` `toSummaryRows` unchanged plus `paidPercent`) and Task 7 (`Summary.test.tsx`, every pre-existing figure assertion kept).
2. **One failing block takes the page down.** The attention read, the chart read and the accounts read are independent: each must fail alone. The `attention` and `charts` promises resolve `{ status: "error" }` (never reject) while `summary` still resolves; the page then shows "No pudimos cargar esto." with "Reintentar" in that block and the month numbers, the tabs and "Por cuenta" still render. Pinned in Task 3 (`loadSummaryView.test.ts` "charts fail alone", "attention fails alone", "attention fails when the accounts cannot be read, while 'Por cuenta' just has no rows") and Task 7 (`Summary.test.tsx` "an error in the attention block or the charts leaves the rest of the page on screen").
3. **The attention block invents or misses an item at a boundary.** Today, today + 7 and today + 8 for planned expenses; yesterday and today for planned incomes; a balance of 0 and of −1; a cap at "available" next to one "near" and one "exceeded"; a reimbursement already fully paid back (left out by `listReimbursableExpenses`); an empty input must give no block at all. Pinned in Task 1 (`attention.test.ts`), Task 2 (`attentionSources.test.ts`: the exact `lte`/`lt` dates of the reads) and Task 5 (`AttentionSection.test.tsx` "renders nothing when nothing needs attention").
4. **A "Ver" link that lands on a filter that does not exist.** Each link must parse back, through the target page's own `parseEntriesQuery`, into the filter it promises (status PLANNED, no lower date, the right upper date), and the three pages without a filter get their plain address. Pinned in Task 3 (`utils.test.ts` "every expense and income link parses back into the target page's filter").
5. **The currency in the address and the tabs disagree.** `?currency=USD` opens USD; an unknown or lower-case code (`?currency=xyz`, `?currency=usd`) falls back or normalises; a currency held only in an account gets a tab at zero; a tab change rewrites the address without navigating; changing the month keeps the currency; a crypto tab never matches a legal-tender query by accident. Pinned in Task 1 (`tabs.test.ts`), Task 3 (`loadSummaryView.test.ts` "gives a currency the user holds an account in a tab at zero"), Task 6 (`MonthSection.test.tsx`, `MonthSelector/utils.test.ts`) and Task 7 (`Summary.test.tsx` "opens the tab the address asks for").

## Execution notes for the controller

- Work in place on branch `develop`, no worktree (node_modules, `.env.local`, the generated Prisma client and the user's running `next dev` live in this directory), no commits.
- **Before dispatching Task 1**, record the current page read-only (the comparison of Task 8 needs it, and the old page is gone after Task 7): with the Playwright MCP browser already signed in (never sign in for the user; check port 3000 first; never restart the server), open `/dashboard/overview` and `/dashboard/overview?month=<previous month>` at desktop width and write down, per currency section, Ingresos (Total, Cobrado, Por cobrar, Reintegros pendientes), Gastos (Total, Pagado, Por pagar), Remanentes (Saldo previo, Actual, Objetivo), and every line and total of "Por cuenta". Leave the browser open.
- **No migration and no Prisma command anywhere in this plan.** No gate is needed: the stage reads existing tables only.
- The user's `next dev` hot-reloads the working tree, so the order keeps the running page whole after every task: Tasks 1 and 2 only add modules nothing imports yet; Task 3 changes the loader additively (the old `Summary` keeps its props; it starts receiving zero rows for account-only currencies and a `paidPercent` it ignores) and the page passes `today`; Tasks 4 and 5 add components nothing renders yet; Task 6 re-lays `CurrencySection` into three columns (the old page shows them stacked per currency, still complete) and adds `MonthSection` unused; Task 7 swaps the composition of `Summary.tsx` and the page in one task.
- Task 1 records the baseline numbers (test files and tests); Task 8 compares against them.
- Unit tests of every task mock the database; browser verification happens only in Task 8 and is read-only (no writes, so no question to the user is needed).

---

### Task 1: Pure calculations in core/summary (days, series, categories, daily balance, attention, tabs)

**Files:**

- Create: `core/summary/days.ts`, `core/summary/days.test.ts`
- Modify: `core/summary/month.ts`, `core/summary/month.test.ts`
- Modify: `core/summary/types.ts`, `core/summary/consts.ts`
- Create: `core/summary/series.ts`, `core/summary/series.test.ts`
- Create: `core/summary/attention.ts`, `core/summary/attention.test.ts`
- Create: `core/summary/tabs.ts`, `core/summary/tabs.test.ts`

**Interfaces:**

- Consumes: `dateToIsoDate`, `isoDateToDate` (`core/incomes/dates.ts`); `monthRange`, `shiftMonth`, `monthOf`, `toYearAndMonth` (private, in `month.ts`) (`core/summary/month.ts`); `minorUnitsToNumber` (`core/incomes/money.ts`); `compareCurrencyCodes` (`core/currencies/crypto.ts`); `DEFAULT_CURRENCY_CODE` (`core/incomes/consts.ts`); `DISPLAY_LOCALE` (`lib/locale`); `EntryStatus` (`core/entries/status.ts`); `CurrencySummary`, `SideSummary` (`core/summary/types.ts`); `EMPTY_SIDE` (`core/summary/consts.ts`); `summarize` (`core/summary/compute.ts`, tests only); `PreviousBalance` (`core/balances/types.ts`); `AccountBalanceRow` (`core/summary/byAccount.ts`, type only); `CardWithUsage`, `CardLimitUsage`, `CardTier` (`core/cards/types.ts`); `BRAND_NAMES` (`core/cards/consts.ts`); `creditCard` (`core/cards/testFixtures.ts`, tests only); `ReimbursableExpense` (`core/reimbursements/types.ts`).
- Produces:
  - `core/summary/days.ts`: `addDays(isoDate: string, days: number): string`, `monthDays(month: string): string[]`, `chartDays(month: string, today: string): string[]`, `lastMonths(month: string, count: number): string[]`.
  - `core/summary/month.ts`: `formatShortMonth(month: string, locale?: string): string`.
  - `core/summary/types.ts`: `DatedGroup`, `CategoryGroup`, `MonthChartSources`, `MonthTotals`, `CurrencyMonthlySeries`, `CategoryAmount`, `CurrencyCategories`, `DailyBalancePoint`, `CurrencyDailyBalance`, `MonthCharts`, `PlannedEntry`, `AttentionKind`, `AttentionSeverity`, `AttentionItem`, `AttentionGroup`, `AttentionReads`, `AttentionSources` (exact shapes in Step 3).
  - `core/summary/consts.ts`: `CHART_MONTHS = 6`, `CATEGORY_TOP_COUNT = 6`, `OTHER_CATEGORIES_NAME = "Otras"`, `UNNAMED_CATEGORY_NAME = "Sin categoría"`, `ATTENTION_DAYS_AHEAD = 7`, `ATTENTION_ITEMS_PER_GROUP = 5`, `ATTENTION_KIND_ORDER: readonly AttentionKind[]`.
  - `core/summary/series.ts`: `monthlySeries(incomes: readonly DatedGroup[], expenses: readonly DatedGroup[], months: readonly string[]): CurrencyMonthlySeries[]`, `categoryBreakdown(groups: readonly CategoryGroup[], names: ReadonlyMap<string, string>, top?: number): CurrencyCategories[]`, `dailyBalance(previous: readonly PreviousBalance[], incomes: readonly DatedGroup[], expenses: readonly DatedGroup[], days: readonly string[]): CurrencyDailyBalance[]`, `buildMonthCharts(sources: MonthChartSources, summary: readonly CurrencySummary[], month: string, today: string): MonthCharts`.
  - `core/summary/attention.ts`: `buildAttention(sources: AttentionSources): AttentionGroup[]`.
  - `core/summary/tabs.ts`: `tabCurrencies(summaryCurrencies: readonly string[], accountCurrencies: readonly string[]): string[]`, `zeroSummary(currency: string): CurrencySummary`, `summariesForTabs(summary: readonly CurrencySummary[], accountCurrencies: readonly string[]): CurrencySummary[]`, `parseCurrencyParam(value: string | string[] | undefined): string | null`.

- [ ] **Step 1: Record the baseline**

Run: `npx vitest run` then `npx tsc --noEmit` then `npm run lint`.
Expected: all green. Write down the numbers of test files and tests (Task 8 compares against them).

- [ ] **Step 2: Write the failing date tests**

Create `core/summary/days.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { addDays, chartDays, lastMonths, monthDays } from "./days";

describe("addDays", () => {
  it("moves a calendar date forward and back, across months and years", () => {
    expect(addDays("2026-10-08", 7)).toBe("2026-10-15");
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("knows which years have a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("monthDays", () => {
  it("lists every day of the month, first to last", () => {
    const days = monthDays("2026-02");

    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2026-02-01");
    expect(days[27]).toBe("2026-02-28");
  });
});

describe("chartDays", () => {
  it("is the whole month once it is over", () => {
    const days = chartDays("2026-09", "2026-10-08");

    expect(days).toHaveLength(30);
    expect(days[29]).toBe("2026-09-30");
  });

  it("stops at today while the month is in course", () => {
    const days = chartDays("2026-10", "2026-10-08");

    expect(days).toHaveLength(8);
    expect(days[7]).toBe("2026-10-08");
  });

  it("is empty for a month that has not started", () => {
    expect(chartDays("2026-11", "2026-10-08")).toEqual([]);
  });
});

describe("lastMonths", () => {
  it("gives the months that end with the given one, oldest first, across a year", () => {
    expect(lastMonths("2026-02", 6)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
```

Append to `core/summary/month.test.ts` (add `formatShortMonth` to its import from `./month`):

```ts
describe("formatShortMonth", () => {
  it("writes a short month and year for the axis of a chart", () => {
    expect(formatShortMonth("2026-09")).toMatch(/^sep/i);
    expect(formatShortMonth("2026-09")).toMatch(/26/);
  });

  it("tells two months apart", () => {
    expect(formatShortMonth("2026-08")).not.toBe(formatShortMonth("2026-09"));
    expect(formatShortMonth("2026-08")).toMatch(/^ago/i);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run core/summary/days.test.ts core/summary/month.test.ts`
Expected: FAIL (`Failed to resolve import "./days"`; `formatShortMonth is not a function` / not exported).

- [ ] **Step 4: Write the date helpers**

Create `core/summary/days.ts`:

```ts
import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";

import { monthRange, shiftMonth } from "./month";

const DAY_MS = 24 * 60 * 60 * 1000;

// The calendar date `days` days after (or, if negative, before) the given one. It works in UTC, so no
// time zone and no daylight saving change ever moves it.
export const addDays = (isoDate: string, days: number): string =>
  dateToIsoDate(new Date(isoDateToDate(isoDate).getTime() + days * DAY_MS));

// Every day of the month, first to last.
export const monthDays = (month: string): string[] => {
  const { from, to } = monthRange(month);
  const days: string[] = [];

  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
};

// The days the balance chart of a month shows: the whole month once it is over, up to today while it
// is in course, and none before it starts (nothing has moved yet).
export const chartDays = (month: string, today: string): string[] =>
  monthDays(month).filter((day) => day <= today);

// The `count` months that end with `month`, oldest first.
export const lastMonths = (month: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    shiftMonth(month, index - count + 1),
  );
```

In `core/summary/month.ts`, after `formatMonth`, add:

```ts
// "sept 26": a short month and year for the axis of a chart. Intl decides the abbreviation.
export const formatShortMonth = (
  month: string,
  locale: string = DISPLAY_LOCALE,
): string => {
  const [year, monthNumber] = toYearAndMonth(month);

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
};
```

Run: `npx vitest run core/summary/days.test.ts core/summary/month.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the types and constants**

Append to `core/summary/types.ts` (add the imports at the top: `import type { CardWithUsage } from "@/core/cards/types";`, `import type { ReimbursableExpense } from "@/core/reimbursements/types";`, `import type { AccountBalanceRow } from "./byAccount";`):

```ts
// What the database returns when grouping entries by currency, day and status (the charts' read).
export interface DatedGroup {
  currency: string;
  date: Date;
  status: EntryStatus;
  _sum: { amount: bigint | null };
}

// What the database returns when grouping a month's expenses by currency and category.
export interface CategoryGroup {
  currency: string;
  categoryId: string;
  _sum: { amount: bigint | null };
}

// Everything the charts of a month are made from, as it was read.
export interface MonthChartSources {
  incomes: readonly DatedGroup[];
  expenses: readonly DatedGroup[];
  categories: readonly CategoryGroup[];
  categoryNames: readonly { id: string; name: string }[];
}

// One month of the 6-month chart, in minor units: its incomes and its expenses "Total".
export interface MonthTotals {
  month: string;
  incomes: number;
  expenses: number;
}

export interface CurrencyMonthlySeries {
  currency: string;
  months: MonthTotals[];
}

// One bar of the category chart. `categoryId` is null for "Otras", which folds the smallest ones.
export interface CategoryAmount {
  categoryId: string | null;
  name: string;
  amount: number;
}

export interface CurrencyCategories {
  currency: string;
  // What every bar adds up to: the month's expenses "Total" in this currency.
  total: number;
  categories: CategoryAmount[];
}

// What the accounts of a currency held at the end of a day, in minor units.
export interface DailyBalancePoint {
  date: string;
  balance: number;
}

export interface CurrencyDailyBalance {
  currency: string;
  points: DailyBalancePoint[];
}

// The three charts of a month, one list per chart, each one per currency (never mixed).
export interface MonthCharts {
  monthly: CurrencyMonthlySeries[];
  categories: CurrencyCategories[];
  daily: CurrencyDailyBalance[];
}

// A planned income or expense as the attention block reads it.
export interface PlannedEntry {
  id: string;
  description: string;
  currency: string;
  // Minor units.
  amount: number;
  // "YYYY-MM-DD": the date the app shows (for a card charge, the day the statement is paid).
  date: string;
}

export type AttentionKind =
  | "overdueExpense"
  | "negativeAccount"
  | "cardLimit"
  | "upcomingExpense"
  | "overdueIncome"
  | "reimbursement";

// Whether the item's amount is shown in the danger colour (overdue, negative, over the cap).
export type AttentionSeverity = "danger" | "warning";

export interface AttentionItem {
  kind: AttentionKind;
  id: string;
  // What it is: the entry's description, "Banco · Cuenta", or "Visa •••• 1234 · Banco".
  title: string;
  currency: string;
  // Minor units of `currency`: the entry's amount, what is outstanding, the balance, or what the card used.
  amount: number;
  // The cap, for a card; null otherwise.
  limit: number | null;
  // "YYYY-MM-DD" for entries and reimbursements; null for accounts and cards.
  date: string | null;
  severity: AttentionSeverity;
}

export interface AttentionGroup {
  kind: AttentionKind;
  // The most urgent ones, at most ATTENTION_ITEMS_PER_GROUP.
  items: AttentionItem[];
  // How many more there are beyond `items`.
  hiddenCount: number;
}

// What the attention read brings from the database (the accounts come from the "Por cuenta" read).
export interface AttentionReads {
  plannedExpenses: PlannedEntry[];
  plannedIncomes: PlannedEntry[];
  reimbursements: ReimbursableExpense[];
  cards: CardWithUsage[];
}

export interface AttentionSources extends AttentionReads {
  // "YYYY-MM-DD", the Argentine calendar date.
  today: string;
  accounts: readonly AccountBalanceRow[];
}
```

Replace the whole of `core/summary/consts.ts` with:

```ts
import type { AttentionKind, SideSummary } from "./types";

// A side of the budget with nothing on it.
export const EMPTY_SIDE: SideSummary = { total: 0, settled: 0, pending: 0 };

// How many months the income-against-expenses chart shows, ending with the month viewed.
export const CHART_MONTHS = 6;

// How many categories keep their own bar before the rest fold into "Otras".
export const CATEGORY_TOP_COUNT = 6;
export const OTHER_CATEGORIES_NAME = "Otras";
// Only for a category that could not be named (it never happens: categories cannot be deleted while
// they have expenses).
export const UNNAMED_CATEGORY_NAME = "Sin categoría";

// A planned expense this many days ahead (today included) already needs attention.
export const ATTENTION_DAYS_AHEAD = 7;

// The lines a group of the attention block shows; the rest are counted.
export const ATTENTION_ITEMS_PER_GROUP = 5;

// The groups of the attention block, the most urgent kind first.
export const ATTENTION_KIND_ORDER: readonly AttentionKind[] = [
  "overdueExpense",
  "negativeAccount",
  "cardLimit",
  "upcomingExpense",
  "overdueIncome",
  "reimbursement",
];
```

Run: `npx tsc --noEmit`
Expected: clean (types only; nothing uses them yet).

- [ ] **Step 6: Write the failing series tests**

Create `core/summary/series.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { summarize } from "./compute";
import {
  buildMonthCharts,
  categoryBreakdown,
  dailyBalance,
  monthlySeries,
} from "./series";
import type { CategoryGroup, DatedGroup, StatusGroup } from "./types";

const day = (
  currency: string,
  date: string,
  status: DatedGroup["status"],
  amount: number,
): DatedGroup => ({
  currency,
  date: new Date(`${date}T00:00:00.000Z`),
  status,
  _sum: { amount: BigInt(amount) },
});

const category = (
  currency: string,
  categoryId: string,
  amount: number,
): CategoryGroup => ({
  currency,
  categoryId,
  _sum: { amount: BigInt(amount) },
});

const MONTHS = ["2026-07", "2026-08", "2026-09"];

describe("monthlySeries", () => {
  it("adds up each month's incomes and expenses, planned and settled alike", () => {
    const series = monthlySeries(
      [
        day("ARS", "2026-09-03", "SETTLED", 1000),
        day("ARS", "2026-09-20", "PLANNED", 500),
        day("ARS", "2026-08-10", "SETTLED", 300),
      ],
      [day("ARS", "2026-09-05", "SETTLED", 200)],
      MONTHS,
    );

    expect(series).toEqual([
      {
        currency: "ARS",
        months: [
          { month: "2026-08", incomes: 300, expenses: 0 },
          { month: "2026-09", incomes: 1500, expenses: 200 },
        ],
      },
    ]);
  });

  it("never counts an installment somebody else covered", () => {
    const [ars] = monthlySeries(
      [],
      [
        day("ARS", "2026-09-05", "SETTLED", 100),
        day("ARS", "2026-09-06", "COVERED", 900),
      ],
      MONTHS,
    );

    expect(ars.months).toEqual([
      { month: "2026-09", incomes: 0, expenses: 100 },
    ]);
  });

  it("never adds currencies together: one series each, in the app's order", () => {
    const series = monthlySeries(
      [
        day("USDC", "2026-09-01", "SETTLED", 1500000),
        day("USD", "2026-09-01", "SETTLED", 50),
        day("ARS", "2026-09-01", "SETTLED", 1000),
      ],
      [],
      MONTHS,
    );

    expect(series.map(({ currency }) => currency)).toEqual([
      "ARS",
      "USD",
      "USDC",
    ]);
    expect(series[1].months).toEqual([
      { month: "2026-09", incomes: 50, expenses: 0 },
    ]);
  });

  it("starts at the first month with something, and keeps an empty month in between at zero", () => {
    const [ars] = monthlySeries(
      [
        day("ARS", "2026-07-01", "SETTLED", 10),
        day("ARS", "2026-09-01", "SETTLED", 30),
      ],
      [],
      MONTHS,
    );

    expect(ars.months.map(({ month }) => month)).toEqual(MONTHS);
    expect(ars.months[1]).toEqual({
      month: "2026-08",
      incomes: 0,
      expenses: 0,
    });
  });

  it("leaves out what falls outside the months asked for, and keeps what falls inside", () => {
    const [ars] = monthlySeries(
      [
        day("ARS", "2026-06-30", "SETTLED", 999),
        day("ARS", "2026-09-01", "SETTLED", 1),
      ],
      [],
      MONTHS,
    );

    expect(ars.months).toEqual([{ month: "2026-09", incomes: 1, expenses: 0 }]);
  });

  it("gives no series to a currency whose sums are empty", () => {
    const empty: DatedGroup = {
      currency: "EUR",
      date: new Date("2026-09-01T00:00:00.000Z"),
      status: "SETTLED",
      _sum: { amount: null },
    };

    expect(monthlySeries([empty], [], MONTHS)).toEqual([]);
    expect(
      monthlySeries([day("EUR", "2026-09-01", "SETTLED", 5)], [], MONTHS),
    ).toHaveLength(1);
  });
});

describe("categoryBreakdown", () => {
  const NAMES = new Map([
    ["cat_food", "Comida"],
    ["cat_rent", "Alquiler"],
    ["cat_fun", "Salidas"],
  ]);

  it("sorts the categories by amount, largest first, with their names and the total", () => {
    expect(
      categoryBreakdown(
        [
          category("ARS", "cat_food", 300),
          category("ARS", "cat_rent", 900),
          category("ARS", "cat_fun", 100),
        ],
        NAMES,
      ),
    ).toEqual([
      {
        currency: "ARS",
        total: 1300,
        categories: [
          { categoryId: "cat_rent", name: "Alquiler", amount: 900 },
          { categoryId: "cat_food", name: "Comida", amount: 300 },
          { categoryId: "cat_fun", name: "Salidas", amount: 100 },
        ],
      },
    ]);
  });

  it("breaks a tie by name", () => {
    const [ars] = categoryBreakdown(
      [category("ARS", "cat_fun", 100), category("ARS", "cat_food", 100)],
      NAMES,
    );

    expect(ars.categories.map(({ name }) => name)).toEqual([
      "Comida",
      "Salidas",
    ]);
  });

  it("folds everything after the sixth into Otras when there are eight or more", () => {
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
    const names = new Map(ids.map((id) => [id, `Categoría ${id}`]));
    const [ars] = categoryBreakdown(
      ids.map((id, index) => category("ARS", id, (8 - index) * 100)),
      names,
    );

    expect(ars.categories).toHaveLength(7);
    expect(ars.categories[6]).toEqual({
      categoryId: null,
      name: "Otras",
      amount: 300,
    });
    expect(ars.total).toBe(3600);
  });

  it("keeps seven categories as they are: an Otras of one would hide its name", () => {
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
    const names = new Map(ids.map((id) => [id, `Categoría ${id}`]));
    const [ars] = categoryBreakdown(
      ids.map((id, index) => category("ARS", id, (7 - index) * 100)),
      names,
    );

    expect(ars.categories).toHaveLength(7);
    expect(ars.categories[6]).toEqual({
      categoryId: "c7",
      name: "Categoría c7",
      amount: 100,
    });
    expect(ars.categories.map(({ name }) => name)).not.toContain("Otras");
  });

  it("gives each currency its own list, never mixed", () => {
    const lists = categoryBreakdown(
      [category("USD", "cat_food", 7), category("ARS", "cat_food", 300)],
      NAMES,
    );

    expect(lists.map(({ currency, total }) => [currency, total])).toEqual([
      ["ARS", 300],
      ["USD", 7],
    ]);
  });

  it("drops a category with nothing in it, and keeps one with something", () => {
    const empty: CategoryGroup = {
      currency: "ARS",
      categoryId: "cat_fun",
      _sum: { amount: null },
    };
    const [ars] = categoryBreakdown(
      [empty, category("ARS", "cat_food", 300)],
      NAMES,
    );

    expect(ars.categories.map(({ categoryId }) => categoryId)).toEqual([
      "cat_food",
    ]);
  });
});

describe("dailyBalance", () => {
  const DAYS = ["2026-09-01", "2026-09-02", "2026-09-03"];

  it("starts from the previous balance, adds each day's settled incomes and takes its settled expenses", () => {
    expect(
      dailyBalance(
        [{ currency: "ARS", amount: 1000 }],
        [day("ARS", "2026-09-02", "SETTLED", 500)],
        [day("ARS", "2026-09-03", "SETTLED", 300)],
        DAYS,
      ),
    ).toEqual([
      {
        currency: "ARS",
        points: [
          { date: "2026-09-01", balance: 1000 },
          { date: "2026-09-02", balance: 1500 },
          { date: "2026-09-03", balance: 1200 },
        ],
      },
    ]);
  });

  it("never moves on planned or covered money", () => {
    const [ars] = dailyBalance(
      [{ currency: "ARS", amount: 1000 }],
      [
        day("ARS", "2026-09-02", "PLANNED", 400),
        day("ARS", "2026-09-02", "SETTLED", 1),
      ],
      [day("ARS", "2026-09-03", "COVERED", 900)],
      DAYS,
    );

    expect(ars.points.map(({ balance }) => balance)).toEqual([
      1000, 1001, 1001,
    ]);
  });

  it("draws one line per currency, in the app's order, also for one with only a previous balance", () => {
    const lines = dailyBalance(
      [{ currency: "USD", amount: 50 }],
      [day("ARS", "2026-09-01", "SETTLED", 10)],
      [],
      DAYS,
    );

    expect(lines.map(({ currency }) => currency)).toEqual(["ARS", "USD"]);
    expect(lines[1].points.map(({ balance }) => balance)).toEqual([50, 50, 50]);
  });

  it("has no point for a month that has not started, but still names the currency", () => {
    const lines = dailyBalance([{ currency: "ARS", amount: 10 }], [], [], []);

    expect(lines).toHaveLength(1);
    expect(lines[0].points).toEqual([]);
  });

  it("ignores what moved outside the days shown (earlier months of the chart's read, or after today)", () => {
    const [ars] = dailyBalance(
      [{ currency: "ARS", amount: 0 }],
      [
        day("ARS", "2026-08-31", "SETTLED", 7),
        day("ARS", "2026-09-20", "SETTLED", 9),
        day("ARS", "2026-09-01", "SETTLED", 1),
      ],
      [],
      DAYS,
    );

    expect(ars.points.map(({ balance }) => balance)).toEqual([1, 1, 1]);
  });
});

describe("buildMonthCharts", () => {
  it("agrees with the month's figures: the viewed month's bars are Ingresos and Gastos Total, the categories add up to Gastos Total, and the line ends at Actual once the month is over", () => {
    const incomes = [
      day("ARS", "2026-08-20", "SETTLED", 7000),
      day("ARS", "2026-09-05", "SETTLED", 100000),
      day("ARS", "2026-09-25", "PLANNED", 40000),
    ];
    const expenses = [
      day("ARS", "2026-09-10", "SETTLED", 30000),
      day("ARS", "2026-09-28", "PLANNED", 20000),
      day("ARS", "2026-09-12", "COVERED", 5000),
    ];
    // The same September as the month's summary reads it: by currency and status.
    const incomeGroups: StatusGroup[] = [
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(40000) } },
    ];
    const expenseGroups: StatusGroup[] = [
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(30000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(20000) } },
      { currency: "ARS", status: "COVERED", _sum: { amount: BigInt(5000) } },
    ];
    const summary = summarize(incomeGroups, expenseGroups, {
      previous: [{ currency: "ARS", amount: 500000 }],
    });
    const [ars] = summary;

    const charts = buildMonthCharts(
      {
        incomes,
        expenses,
        categories: [
          category("ARS", "cat_food", 30000),
          category("ARS", "cat_rent", 20000),
        ],
        categoryNames: [
          { id: "cat_food", name: "Comida" },
          { id: "cat_rent", name: "Alquiler" },
        ],
      },
      summary,
      "2026-09",
      "2026-10-08",
    );

    const months = charts.monthly[0].months;
    const points = charts.daily[0].points;

    expect(months[months.length - 1]).toEqual({
      month: "2026-09",
      incomes: ars.incomes.total,
      expenses: ars.expenses.total,
    });
    expect(months[0]).toEqual({ month: "2026-08", incomes: 7000, expenses: 0 });
    expect(charts.categories[0].total).toBe(ars.expenses.total);
    expect(points).toHaveLength(30);
    expect(points[points.length - 1].balance).toBe(ars.current);
    expect(points[0].balance).toBe(ars.previous);
  });
});
```

- [ ] **Step 7: Run them to see them fail**

Run: `npx vitest run core/summary/series.test.ts`
Expected: FAIL (`Failed to resolve import "./series"`).

- [ ] **Step 8: Write the series**

Create `core/summary/series.ts`:

```ts
import type { PreviousBalance } from "@/core/balances/types";
import { compareCurrencyCodes } from "@/core/currencies/crypto";
import { dateToIsoDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { DISPLAY_LOCALE } from "@/lib/locale";

import {
  CATEGORY_TOP_COUNT,
  CHART_MONTHS,
  OTHER_CATEGORIES_NAME,
  UNNAMED_CATEGORY_NAME,
} from "./consts";
import { chartDays, lastMonths } from "./days";
import { monthOf } from "./month";
import type {
  CategoryAmount,
  CategoryGroup,
  CurrencyCategories,
  CurrencyDailyBalance,
  CurrencyMonthlySeries,
  CurrencySummary,
  DatedGroup,
  MonthChartSources,
  MonthCharts,
  MonthTotals,
} from "./types";

// The charts of the summary, per currency (currencies are never added together). Pure: they work on
// the grouped rows the chart read returns, so every rule here is the summary's own: a month's "Total"
// counts PLANNED and SETTLED (COVERED never moved money) and a balance moves only on SETTLED money.

const amountOf = (group: { _sum: { amount: bigint | null } }): number =>
  group._sum.amount === null ? 0 : minorUnitsToNumber(group._sum.amount);

const byCurrencyOrder = <T extends { currency: string }>(a: T, b: T): number =>
  compareCurrencyCodes(a.currency, b.currency);

// Each month's incomes and expenses "Total" per currency, for the months given (oldest first). A
// currency starts at its first month with something; an empty month after it shows at zero.
export const monthlySeries = (
  incomes: readonly DatedGroup[],
  expenses: readonly DatedGroup[],
  months: readonly string[],
): CurrencyMonthlySeries[] => {
  const byCurrency = new Map<string, Map<string, MonthTotals>>();

  const add = (
    groups: readonly DatedGroup[],
    side: "incomes" | "expenses",
  ): void => {
    for (const group of groups) {
      const month = monthOf(dateToIsoDate(group.date));
      const amount = amountOf(group);

      if (
        group.status === "COVERED" ||
        amount === 0 ||
        !months.includes(month)
      ) {
        continue;
      }

      const totals =
        byCurrency.get(group.currency) ??
        new Map(
          months.map((each) => [
            each,
            { month: each, incomes: 0, expenses: 0 },
          ]),
        );
      const row = totals.get(month);

      if (row) {
        row[side] += amount;
      }

      byCurrency.set(group.currency, totals);
    }
  };

  add(incomes, "incomes");
  add(expenses, "expenses");

  return [...byCurrency.entries()]
    .map(([currency, totals]) => {
      const rows = months.flatMap((month) => {
        const row = totals.get(month);

        return row ? [row] : [];
      });
      const first = rows.findIndex(
        ({ incomes: inflow, expenses: outflow }) =>
          inflow !== 0 || outflow !== 0,
      );

      return { currency, months: first === -1 ? [] : rows.slice(first) };
    })
    .filter(({ months: rows }) => rows.length > 0)
    .sort(byCurrencyOrder);
};

// The month's expenses per category, per currency, largest first (a tie goes by name). With more than
// one category beyond `top`, those fold into "Otras"; a single one keeps its own name.
export const categoryBreakdown = (
  groups: readonly CategoryGroup[],
  names: ReadonlyMap<string, string>,
  top: number = CATEGORY_TOP_COUNT,
): CurrencyCategories[] => {
  const byCurrency = new Map<string, CategoryAmount[]>();

  for (const group of groups) {
    const amount = amountOf(group);

    if (amount === 0) {
      continue;
    }

    byCurrency.set(group.currency, [
      ...(byCurrency.get(group.currency) ?? []),
      {
        categoryId: group.categoryId,
        name: names.get(group.categoryId) ?? UNNAMED_CATEGORY_NAME,
        amount,
      },
    ]);
  }

  return [...byCurrency.entries()]
    .map(([currency, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          b.amount - a.amount || a.name.localeCompare(b.name, DISPLAY_LOCALE),
      );
      const total = sorted.reduce((sum, { amount }) => sum + amount, 0);

      if (sorted.length <= top + 1) {
        return { currency, total, categories: sorted };
      }

      const rest = sorted.slice(top);

      return {
        currency,
        total,
        categories: [
          ...sorted.slice(0, top),
          {
            categoryId: null,
            name: OTHER_CATEGORIES_NAME,
            amount: rest.reduce((sum, { amount }) => sum + amount, 0),
          },
        ],
      };
    })
    .sort(byCurrencyOrder);
};

// What the accounts of each currency held at the end of each of `days`: the previous balance plus the
// settled incomes and minus the settled expenses up to that day. A currency with a previous balance or
// a settled movement in those days gets a line, even with no day to show.
export const dailyBalance = (
  previous: readonly PreviousBalance[],
  incomes: readonly DatedGroup[],
  expenses: readonly DatedGroup[],
  days: readonly string[],
): CurrencyDailyBalance[] => {
  const shown = new Set(days);
  const moves = new Map<string, Map<string, number>>();

  const add = (groups: readonly DatedGroup[], sign: 1 | -1): void => {
    for (const group of groups) {
      const date = dateToIsoDate(group.date);

      if (group.status !== "SETTLED" || !shown.has(date)) {
        continue;
      }

      const byDay = moves.get(group.currency) ?? new Map<string, number>();

      byDay.set(date, (byDay.get(date) ?? 0) + sign * amountOf(group));
      moves.set(group.currency, byDay);
    }
  };

  add(incomes, 1);
  add(expenses, -1);

  const currencies = [
    ...new Set([...previous.map(({ currency }) => currency), ...moves.keys()]),
  ].sort(compareCurrencyCodes);

  return currencies.map((currency) => {
    let balance =
      previous.find((row) => row.currency === currency)?.amount ?? 0;
    const byDay = moves.get(currency);

    return {
      currency,
      points: days.map((date) => {
        balance += byDay?.get(date) ?? 0;

        return { date, balance };
      }),
    };
  });
};

// The three charts of `month`, from the chart read and the month's own summary (its "Saldo previo" is
// where the daily line starts).
export const buildMonthCharts = (
  { incomes, expenses, categories, categoryNames }: MonthChartSources,
  summary: readonly CurrencySummary[],
  month: string,
  today: string,
): MonthCharts => ({
  monthly: monthlySeries(incomes, expenses, lastMonths(month, CHART_MONTHS)),
  categories: categoryBreakdown(
    categories,
    new Map(categoryNames.map(({ id, name }) => [id, name])),
  ),
  daily: dailyBalance(
    summary.map(({ currency, previous }) => ({ currency, amount: previous })),
    incomes,
    expenses,
    chartDays(month, today),
  ),
});
```

Run: `npx vitest run core/summary/series.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing attention tests**

Create `core/summary/attention.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { creditCard } from "@/core/cards/testFixtures";
import type {
  CardLimitUsage,
  CardTier,
  CardWithUsage,
} from "@/core/cards/types";

import { buildAttention } from "./attention";
import type { AccountBalanceRow } from "./byAccount";
import { ATTENTION_KIND_ORDER } from "./consts";
import type { AttentionSources, PlannedEntry } from "./types";

const TODAY = "2026-10-08";

const NOTHING: AttentionSources = {
  today: TODAY,
  plannedExpenses: [],
  plannedIncomes: [],
  reimbursements: [],
  accounts: [],
  cards: [],
};

const entry = (id: string, date: string, amount = 1000): PlannedEntry => ({
  id,
  description: `Entrada ${id}`,
  currency: "ARS",
  amount,
  date,
});

const account = (
  accountId: string,
  balance: number,
  currency = "ARS",
): AccountBalanceRow => ({
  accountId,
  accountName: "Caja",
  bankId: "b1",
  bankName: "Galicia",
  currency,
  balance,
  archived: false,
});

const usage = (
  tier: CardTier,
  used: number,
  currency = "ARS",
  amount = 100000,
): CardLimitUsage => ({
  currency,
  amount,
  committedTotal: used,
  monthUsed: used,
  used,
  available: amount - used,
  tier,
});

const card = (id: string, limits: CardLimitUsage[]): CardWithUsage => ({
  ...creditCard({ id }),
  usage: limits,
});

const ids = (sources: AttentionSources) =>
  buildAttention(sources).flatMap(({ items }) => items.map(({ id }) => id));

describe("buildAttention", () => {
  it("is empty when nothing needs attention: it never invents an item", () => {
    expect(buildAttention(NOTHING)).toEqual([]);
  });

  it("lists an expense dated before today as overdue, from today to seven days ahead as upcoming, and not one eight days ahead", () => {
    const groups = buildAttention({
      ...NOTHING,
      plannedExpenses: [
        entry("e_yesterday", "2026-10-07"),
        entry("e_today", "2026-10-08"),
        entry("e_week", "2026-10-15"),
        entry("e_later", "2026-10-16"),
      ],
    });

    expect(groups.map(({ kind }) => kind)).toEqual([
      "overdueExpense",
      "upcomingExpense",
    ]);
    expect(groups[0].items.map(({ id }) => id)).toEqual(["e_yesterday"]);
    expect(groups[1].items.map(({ id }) => id)).toEqual(["e_today", "e_week"]);
    expect(
      groups.flatMap(({ items }) => items.map(({ id }) => id)),
    ).not.toContain("e_later");
  });

  it("lists a planned income only once its day has passed", () => {
    const listed = ids({
      ...NOTHING,
      plannedIncomes: [
        entry("i_yesterday", "2026-10-07"),
        entry("i_today", "2026-10-08"),
      ],
    });

    expect(listed).toEqual(["i_yesterday"]);
    expect(listed).not.toContain("i_today");
  });

  it("lists the oldest first inside a group", () => {
    const [overdue] = buildAttention({
      ...NOTHING,
      plannedExpenses: [
        entry("e_october", "2026-10-01"),
        entry("e_september", "2026-09-15"),
      ],
    });

    expect(overdue.items.map(({ id }) => id)).toEqual([
      "e_september",
      "e_october",
    ]);
  });

  it("puts the groups in order, the most urgent kind first", () => {
    const groups = buildAttention({
      today: TODAY,
      plannedExpenses: [
        entry("e_old", "2026-10-01"),
        entry("e_soon", "2026-10-10"),
      ],
      plannedIncomes: [entry("i_old", "2026-10-01")],
      reimbursements: [
        {
          id: "r1",
          description: "Médico",
          date: "2026-09-01",
          currency: "ARS",
          outstanding: 5000,
        },
      ],
      accounts: [account("a1", -100)],
      cards: [card("card_1", [usage("near", 85000)])],
    });

    expect(groups.map(({ kind }) => kind)).toEqual([...ATTENTION_KIND_ORDER]);
  });

  it("shows at most five lines per group and counts the rest", () => {
    const seven = ["01", "02", "03", "04", "05", "06", "07"].map((dayOfMonth) =>
      entry(`e_${dayOfMonth}`, `2026-10-${dayOfMonth}`),
    );
    const [overdue] = buildAttention({ ...NOTHING, plannedExpenses: seven });
    const [few] = buildAttention({
      ...NOTHING,
      plannedExpenses: seven.slice(0, 5),
    });

    expect(overdue.items).toHaveLength(5);
    expect(overdue.hiddenCount).toBe(2);
    expect(few.items).toHaveLength(5);
    expect(few.hiddenCount).toBe(0);
  });

  it("lists an account below zero with its bank, name and balance, and not one at zero or above", () => {
    const groups = buildAttention({
      ...NOTHING,
      accounts: [
        account("a_neg", -1),
        account("a_zero", 0),
        account("a_pos", 100),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toEqual([
      {
        kind: "negativeAccount",
        id: "a_neg",
        title: "Galicia · Caja",
        currency: "ARS",
        amount: -1,
        limit: null,
        date: null,
        severity: "danger",
      },
    ]);
  });

  it("lists every cap that is near or over, the one over first, and never an available one", () => {
    const groups = buildAttention({
      ...NOTHING,
      cards: [
        card("card_1", [
          usage("near", 85000),
          usage("available", 10, "USD", 100),
        ]),
        card("card_2", [usage("exceeded", 120000)]),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map(({ id }) => id)).toEqual([
      "card_2:ARS",
      "card_1:ARS",
    ]);
    expect(groups[0].items.map(({ severity }) => severity)).toEqual([
      "danger",
      "warning",
    ]);
    expect(groups[0].items[1]).toMatchObject({
      title: "Visa •••• 1234 · Banco Galicia",
      currency: "ARS",
      amount: 85000,
      limit: 100000,
      date: null,
    });
  });

  it("lists every pending reimbursement with what is still outstanding", () => {
    const [group] = buildAttention({
      ...NOTHING,
      reimbursements: [
        {
          id: "r1",
          description: "Médico",
          date: "2026-09-01",
          currency: "USD",
          outstanding: 5000,
        },
      ],
    });

    expect(group.items).toEqual([
      {
        kind: "reimbursement",
        id: "r1",
        title: "Médico",
        currency: "USD",
        amount: 5000,
        limit: null,
        date: "2026-09-01",
        severity: "warning",
      },
    ]);
  });

  it("marks overdue entries as danger and upcoming ones as warning", () => {
    const groups = buildAttention({
      ...NOTHING,
      plannedExpenses: [
        entry("e_old", "2026-10-01"),
        entry("e_soon", "2026-10-10"),
      ],
      plannedIncomes: [entry("i_old", "2026-10-01")],
    });

    expect(groups.map(({ kind, items }) => [kind, items[0].severity])).toEqual([
      ["overdueExpense", "danger"],
      ["upcomingExpense", "warning"],
      ["overdueIncome", "danger"],
    ]);
  });
});
```

- [ ] **Step 10: Run them to see them fail**

Run: `npx vitest run core/summary/attention.test.ts`
Expected: FAIL (`Failed to resolve import "./attention"`).

- [ ] **Step 11: Write the attention rules**

Create `core/summary/attention.ts`:

```ts
import { BRAND_NAMES } from "@/core/cards/consts";
import { compareCurrencyCodes } from "@/core/currencies/crypto";

import {
  ATTENTION_DAYS_AHEAD,
  ATTENTION_ITEMS_PER_GROUP,
  ATTENTION_KIND_ORDER,
} from "./consts";
import { addDays } from "./days";
import type {
  AttentionGroup,
  AttentionItem,
  AttentionKind,
  AttentionSources,
  PlannedEntry,
} from "./types";

// What needs the user's attention today. Pure: it works on rows already read, and it never invents
// an item: a group with nothing in it is left out, and so is the whole block when nothing applies.
// Every amount stays in its own currency.

const byDate = (
  a: { date: string; id: string },
  b: { date: string; id: string },
): number => a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

const fromEntry =
  (kind: AttentionKind, severity: AttentionItem["severity"]) =>
  ({
    id,
    description,
    currency,
    amount,
    date,
  }: PlannedEntry): AttentionItem => ({
    kind,
    id,
    title: description,
    currency,
    amount,
    limit: null,
    date,
    severity,
  });

export const buildAttention = ({
  today,
  plannedExpenses,
  plannedIncomes,
  reimbursements,
  accounts,
  cards,
}: AttentionSources): AttentionGroup[] => {
  const horizon = addDays(today, ATTENTION_DAYS_AHEAD);
  const expenses = [...plannedExpenses].sort(byDate);

  const items: Record<AttentionKind, AttentionItem[]> = {
    overdueExpense: expenses
      .filter(({ date }) => date < today)
      .map(fromEntry("overdueExpense", "danger")),
    upcomingExpense: expenses
      .filter(({ date }) => date >= today && date <= horizon)
      .map(fromEntry("upcomingExpense", "warning")),
    overdueIncome: plannedIncomes
      .filter(({ date }) => date < today)
      .sort(byDate)
      .map(fromEntry("overdueIncome", "danger")),
    reimbursement: [...reimbursements]
      .sort(byDate)
      .map(
        ({ id, description, currency, outstanding, date }): AttentionItem => ({
          kind: "reimbursement",
          id,
          title: description,
          currency,
          amount: outstanding,
          limit: null,
          date,
          severity: "warning",
        }),
      ),
    negativeAccount: accounts
      .filter(({ balance }) => balance < 0)
      .sort(
        (a, b) =>
          compareCurrencyCodes(a.currency, b.currency) ||
          a.balance - b.balance ||
          a.accountId.localeCompare(b.accountId),
      )
      .map(
        ({
          accountId,
          bankName,
          accountName,
          currency,
          balance,
        }): AttentionItem => ({
          kind: "negativeAccount",
          id: accountId,
          title: `${bankName} · ${accountName}`,
          currency,
          amount: balance,
          limit: null,
          date: null,
          severity: "danger",
        }),
      ),
    cardLimit: cards
      .flatMap((card) =>
        card.usage
          .filter(({ tier }) => tier !== "available")
          .map((cap) => ({ card, cap })),
      )
      .sort(
        (a, b) =>
          Number(b.cap.tier === "exceeded") -
            Number(a.cap.tier === "exceeded") ||
          b.cap.used / b.cap.amount - a.cap.used / a.cap.amount ||
          a.card.id.localeCompare(b.card.id),
      )
      .map(({ card, cap }): AttentionItem => ({
        kind: "cardLimit",
        id: `${card.id}:${cap.currency}`,
        title: `${BRAND_NAMES[card.brand]} •••• ${card.last4} · ${card.bankName}`,
        currency: cap.currency,
        amount: cap.used,
        limit: cap.amount,
        date: null,
        severity: cap.tier === "exceeded" ? "danger" : "warning",
      })),
  };

  return ATTENTION_KIND_ORDER.flatMap((kind) => {
    const all = items[kind];

    return all.length === 0
      ? []
      : [
          {
            kind,
            items: all.slice(0, ATTENTION_ITEMS_PER_GROUP),
            hiddenCount: Math.max(0, all.length - ATTENTION_ITEMS_PER_GROUP),
          },
        ];
  });
};
```

Note: `plannedIncomes.filter(…)` returns a new array, so `.sort` never changes the input. The `: AttentionItem` return annotations on the three `.map` callbacks are required: without them TypeScript widens `kind` and `severity` to `string` and the `Record<AttentionKind, AttentionItem[]>` does not compile (prettier may re-wrap those lines; keep the annotations).

Run: `npx vitest run core/summary/attention.test.ts`
Expected: PASS.

- [ ] **Step 12: Write the failing tab tests**

Create `core/summary/tabs.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  parseCurrencyParam,
  summariesForTabs,
  tabCurrencies,
  zeroSummary,
} from "./tabs";
import type { CurrencySummary } from "./types";

const ARS: CurrencySummary = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  previous: 500000,
  current: 570000,
  target: 590000,
  pendingReimbursements: 4000,
};

describe("tabCurrencies", () => {
  it("puts ARS first, then the others in the app's order: legal tender, then crypto", () => {
    expect(tabCurrencies(["USD", "USDC"], ["EUR", "ARS"])).toEqual([
      "ARS",
      "EUR",
      "USD",
      "USDC",
    ]);
  });

  it("gives a currency held only in an account a tab of its own", () => {
    expect(tabCurrencies([], ["USD"])).toEqual(["USD"]);
  });

  it("never repeats a currency that is in both lists", () => {
    expect(tabCurrencies(["ARS", "USD"], ["USD", "ARS"])).toEqual([
      "ARS",
      "USD",
    ]);
  });

  it("is ARS alone when there is nothing at all, so the month keeps its shape", () => {
    expect(tabCurrencies([], [])).toEqual(["ARS"]);
  });
});

describe("summariesForTabs", () => {
  it("keeps every row the summary computed, untouched, and adds a zero row for a currency only held in an account", () => {
    const rows = summariesForTabs([ARS], ["USD"]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(ARS);
    expect(rows[1]).toEqual(zeroSummary("USD"));
    expect(rows[1]).toEqual({
      currency: "USD",
      incomes: { total: 0, settled: 0, pending: 0 },
      expenses: { total: 0, settled: 0, pending: 0 },
      previous: 0,
      current: 0,
      target: 0,
      pendingReimbursements: 0,
    });
  });

  it("adds no row when every account currency already has one", () => {
    expect(summariesForTabs([ARS], ["ARS"])).toEqual([ARS]);
  });
});

describe("parseCurrencyParam", () => {
  it("reads the code the address asks for, in capitals", () => {
    expect(parseCurrencyParam("USD")).toBe("USD");
    expect(parseCurrencyParam(" usdc ")).toBe("USDC");
  });

  it("reads nothing from a missing, empty or repeated parameter", () => {
    expect(parseCurrencyParam(undefined)).toBeNull();
    expect(parseCurrencyParam("")).toBeNull();
    expect(parseCurrencyParam(["USD", "EUR"])).toBeNull();
  });
});
```

- [ ] **Step 13: Run them to see them fail**

Run: `npx vitest run core/summary/tabs.test.ts`
Expected: FAIL (`Failed to resolve import "./tabs"`).

- [ ] **Step 14: Write the tab helpers**

Create `core/summary/tabs.ts`:

```ts
import { compareCurrencyCodes } from "@/core/currencies/crypto";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import { EMPTY_SIDE } from "./consts";
import type { CurrencySummary } from "./types";

// The currencies of the month block's tabs: the month's own and every currency the user holds an
// account in, ARS first, then the app's order (legal tender by code, then crypto). Never empty: with
// nothing at all the month shows ARS at zero.
export const tabCurrencies = (
  summaryCurrencies: readonly string[],
  accountCurrencies: readonly string[],
): string[] => {
  const codes = [...new Set([...summaryCurrencies, ...accountCurrencies])].sort(
    compareCurrencyCodes,
  );

  if (codes.length === 0) {
    return [DEFAULT_CURRENCY_CODE];
  }

  return codes.includes(DEFAULT_CURRENCY_CODE)
    ? [
        DEFAULT_CURRENCY_CODE,
        ...codes.filter((code) => code !== DEFAULT_CURRENCY_CODE),
      ]
    : codes;
};

// A currency with nothing in the month: every figure at zero.
export const zeroSummary = (currency: string): CurrencySummary => ({
  currency,
  incomes: { ...EMPTY_SIDE },
  expenses: { ...EMPTY_SIDE },
  previous: 0,
  current: 0,
  target: 0,
  pendingReimbursements: 0,
});

// One summary per tab, in the tabs' order. The rows the month's summary computed are handed on as they
// are (the very same objects); only a tab without one gets a row at zero.
export const summariesForTabs = (
  summary: readonly CurrencySummary[],
  accountCurrencies: readonly string[],
): CurrencySummary[] => {
  const byCurrency = new Map(summary.map((row) => [row.currency, row]));

  return tabCurrencies(
    summary.map(({ currency }) => currency),
    accountCurrencies,
  ).map((currency) => byCurrency.get(currency) ?? zeroSummary(currency));
};

// The currency the address asks for (`?currency=usd` reads "USD"), or null when it asks for none or
// for two. Whether the user has such a tab is decided by the month block.
export const parseCurrencyParam = (
  value: string | string[] | undefined,
): string | null =>
  typeof value === "string" && value.trim() !== ""
    ? value.trim().toUpperCase()
    : null;
```

Run: `npx vitest run core/summary/tabs.test.ts`
Expected: PASS.

- [ ] **Step 15: Verify the task boundary**

Run: `npx vitest run core/summary`, `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/summary/days.ts core/summary/days.test.ts core/summary/month.ts core/summary/month.test.ts core/summary/types.ts core/summary/consts.ts core/summary/series.ts core/summary/series.test.ts core/summary/attention.ts core/summary/attention.test.ts core/summary/tabs.ts core/summary/tabs.test.ts`.
Expected: all green. No existing test changes (`compute.ts` still imports `EMPTY_SIDE` from `./consts`, which keeps its value).

- [ ] **Step 16: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 2: The reads behind the charts and the attention block (scoped by userId)

**Files:**

- Create: `core/summary/charts.ts`, `core/summary/charts.test.ts`
- Create: `core/summary/attentionSources.ts`, `core/summary/attentionSources.test.ts`

**Interfaces:**

- Consumes: `prisma` (`infrastructure/db/client`); `isoDateToDate`, `dateToIsoDate` (`core/incomes/dates.ts`); `minorUnitsToNumber` (`core/incomes/money.ts`); `MONEY_STATUSES` (`core/entries/status.ts`); `monthRange`, `monthOf` (`core/summary/month.ts`); `lastMonths`, `addDays` (Task 1); `CHART_MONTHS`, `ATTENTION_DAYS_AHEAD` (Task 1); `MonthChartSources`, `AttentionReads`, `PlannedEntry` (Task 1); `listCards(userId: string, month?: string): Promise<CardWithUsage[]>` (`core/cards/service.ts`); `listReimbursableExpenses(userId: string): Promise<ReimbursableExpense[]>` (`core/reimbursements/service.ts`).
- Produces:
  - `core/summary/charts.ts`: `readMonthChartSources(userId: string, month: string): Promise<MonthChartSources>`.
  - `core/summary/attentionSources.ts`: `readAttentionSources(userId: string, today: string): Promise<AttentionReads>`.

- [ ] **Step 1: Write the failing chart read tests**

Create `core/summary/charts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { groupBy: vi.fn() },
  expense: { groupBy: vi.fn() },
  expenseCategory: { findMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { readMonthChartSources } from "./charts";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.income.groupBy.mockResolvedValue([]);
  db.expense.groupBy.mockResolvedValue([]);
  db.expenseCategory.findMany.mockResolvedValue([]);
});

describe("readMonthChartSources", () => {
  it("groups the user's planned and settled incomes and expenses of the six months that end with the month, by currency, day and status", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    const query = {
      by: ["currency", "date", "status"],
      where: {
        userId: USER_ID,
        status: { in: ["PLANNED", "SETTLED"] },
        date: {
          gte: new Date("2026-04-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
      },
      _sum: { amount: true },
    };

    expect(db.income.groupBy).toHaveBeenCalledWith(query);
    expect(db.expense.groupBy).toHaveBeenCalledWith(query);
  });

  it("groups the month's planned and settled expenses by currency and category", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    expect(db.expense.groupBy).toHaveBeenCalledWith({
      by: ["currency", "categoryId"],
      where: {
        userId: USER_ID,
        status: { in: ["PLANNED", "SETTLED"] },
        date: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
      },
      _sum: { amount: true },
    });
    expect(db.expense.groupBy).toHaveBeenCalledTimes(2);
  });

  it("reads only the user's own category names", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    expect(db.expenseCategory.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: { id: true, name: true },
    });
  });

  it("hands back what it read, as it came", async () => {
    const income = {
      currency: "ARS",
      date: new Date("2026-09-02T00:00:00.000Z"),
      status: "SETTLED",
      _sum: { amount: BigInt(1000) },
    };
    const byCategory = {
      currency: "ARS",
      categoryId: "cat_food",
      _sum: { amount: BigInt(300) },
    };

    db.income.groupBy.mockResolvedValue([income]);
    // The series read first, the categories second (the order of the calls in the code).
    db.expense.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([byCategory]);
    db.expenseCategory.findMany.mockResolvedValue([
      { id: "cat_food", name: "Comida" },
    ]);

    await expect(readMonthChartSources(USER_ID, "2026-09")).resolves.toEqual({
      incomes: [income],
      expenses: [],
      categories: [byCategory],
      categoryNames: [{ id: "cat_food", name: "Comida" }],
    });
  });

  it("rejects when a read fails, so the loader can isolate the charts", async () => {
    db.expenseCategory.findMany.mockRejectedValue(new Error("database down"));

    await expect(readMonthChartSources(USER_ID, "2026-09")).rejects.toThrow(
      "database down",
    );
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run core/summary/charts.test.ts`
Expected: FAIL (`Failed to resolve import "./charts"`).

- [ ] **Step 3: Write the chart read**

Create `core/summary/charts.ts`:

```ts
import { MONEY_STATUSES } from "@/core/entries/status";
import { isoDateToDate } from "@/core/incomes/dates";
import { prisma } from "@/infrastructure/db/client";

import { CHART_MONTHS } from "./consts";
import { lastMonths } from "./days";
import { monthRange } from "./month";
import type { MonthChartSources } from "./types";

// Everything the three charts of a month need, in four grouped queries that run together: the
// incomes and the expenses of the six months that end with `month`, by currency, day and status (the
// 6-month bars and, from the same rows, the month's daily balance), the month's expenses by currency
// and category, and the user's category names. COVERED entries never moved money, so none is read.
// Only the user's own rows are ever read: the owner leads every filter.
export const readMonthChartSources = async (
  userId: string,
  month: string,
): Promise<MonthChartSources> => {
  const [firstMonth] = lastMonths(month, CHART_MONTHS);
  const { from: monthFrom, to } = monthRange(month);
  const statuses = { in: [...MONEY_STATUSES] };
  const seriesQuery = {
    by: ["currency", "date", "status"] as ("currency" | "date" | "status")[],
    where: {
      userId,
      status: statuses,
      date: {
        gte: isoDateToDate(monthRange(firstMonth).from),
        lte: isoDateToDate(to),
      },
    },
    _sum: { amount: true as const },
  };

  const [incomes, expenses, categories, categoryNames] = await Promise.all([
    prisma.income.groupBy(seriesQuery),
    prisma.expense.groupBy(seriesQuery),
    prisma.expense.groupBy({
      by: ["currency", "categoryId"] as ("currency" | "categoryId")[],
      where: {
        userId,
        status: statuses,
        date: { gte: isoDateToDate(monthFrom), lte: isoDateToDate(to) },
      },
      _sum: { amount: true as const },
    }),
    prisma.expenseCategory.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
  ]);

  return { incomes, expenses, categories, categoryNames };
};
```

If `tsc` rejects the grouped rows as `MonthChartSources` (Prisma's `groupBy` result type is a mapped type), map them explicitly instead of returning them as they are, keeping the same values:

```ts
return {
  incomes: incomes.map(({ currency, date, status, _sum }) => ({
    currency,
    date,
    status,
    _sum,
  })),
  expenses: expenses.map(({ currency, date, status, _sum }) => ({
    currency,
    date,
    status,
    _sum,
  })),
  categories: categories.map(({ currency, categoryId, _sum }) => ({
    currency,
    categoryId,
    _sum,
  })),
  categoryNames,
};
```

(the "hands back what it read" test passes either way: `toEqual` compares values).

Run: `npx vitest run core/summary/charts.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing attention read tests**

Create `core/summary/attentionSources.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  expense: { findMany: vi.fn() },
  income: { findMany: vi.fn() },
}));
const cards = vi.hoisted(() => ({ listCards: vi.fn() }));
const reimbursements = vi.hoisted(() => ({
  listReimbursableExpenses: vi.fn(),
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/cards/service", () => cards);
vi.mock("@/core/reimbursements/service", () => reimbursements);

import { readAttentionSources } from "./attentionSources";

const USER_ID = "user_123";
const TODAY = "2026-10-08";

const SELECT = {
  id: true,
  description: true,
  amount: true,
  currency: true,
  date: true,
};
const ORDER = [{ date: "asc" }, { id: "asc" }];

beforeEach(() => {
  vi.resetAllMocks();
  db.expense.findMany.mockResolvedValue([]);
  db.income.findMany.mockResolvedValue([]);
  cards.listCards.mockResolvedValue([]);
  reimbursements.listReimbursableExpenses.mockResolvedValue([]);
});

describe("readAttentionSources", () => {
  it("reads the user's planned expenses up to seven days ahead, today included, oldest first", async () => {
    await readAttentionSources(USER_ID, TODAY);

    expect(db.expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: "PLANNED",
        date: { lte: new Date("2026-10-15T00:00:00.000Z") },
      },
      select: SELECT,
      orderBy: ORDER,
    });
  });

  it("reads the user's planned incomes dated before today, not today's", async () => {
    await readAttentionSources(USER_ID, TODAY);

    expect(db.income.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        status: "PLANNED",
        date: { lt: new Date("2026-10-08T00:00:00.000Z") },
      },
      select: SELECT,
      orderBy: ORDER,
    });
  });

  it("turns amounts into numbers and dates into calendar days", async () => {
    db.expense.findMany.mockResolvedValue([
      {
        id: "e1",
        description: "Luz",
        amount: BigInt(150000),
        currency: "ARS",
        date: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);

    const sources = await readAttentionSources(USER_ID, TODAY);

    expect(sources.plannedExpenses).toEqual([
      {
        id: "e1",
        description: "Luz",
        amount: 150000,
        currency: "ARS",
        date: "2026-10-01",
      },
    ]);
    expect(sources.plannedIncomes).toEqual([]);
  });

  it("reads the user's reimbursements and cards, the cards measured in today's month", async () => {
    const reimbursement = {
      id: "r1",
      description: "Médico",
      date: "2026-09-01",
      currency: "ARS",
      outstanding: 5000,
    };

    reimbursements.listReimbursableExpenses.mockResolvedValue([reimbursement]);

    const sources = await readAttentionSources(USER_ID, TODAY);

    expect(reimbursements.listReimbursableExpenses).toHaveBeenCalledWith(
      USER_ID,
    );
    expect(cards.listCards).toHaveBeenCalledWith(USER_ID, "2026-10");
    expect(sources.reimbursements).toEqual([reimbursement]);
  });

  it("rejects when a read fails, so the loader can isolate the block", async () => {
    cards.listCards.mockRejectedValue(new Error("database down"));

    await expect(readAttentionSources(USER_ID, TODAY)).rejects.toThrow(
      "database down",
    );
  });
});
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx vitest run core/summary/attentionSources.test.ts`
Expected: FAIL (`Failed to resolve import "./attentionSources"`).

- [ ] **Step 6: Write the attention read**

Create `core/summary/attentionSources.ts`:

```ts
import { listCards } from "@/core/cards/service";
import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { listReimbursableExpenses } from "@/core/reimbursements/service";
import { prisma } from "@/infrastructure/db/client";

import { ATTENTION_DAYS_AHEAD } from "./consts";
import { addDays } from "./days";
import { monthOf } from "./month";
import type { AttentionReads, PlannedEntry } from "./types";

const PLANNED_SELECT = {
  id: true,
  description: true,
  amount: true,
  currency: true,
  date: true,
} as const;

const OLDEST_FIRST = [{ date: "asc" as const }, { id: "asc" as const }];

const toPlanned = (row: {
  id: string;
  description: string;
  amount: bigint;
  currency: string;
  date: Date;
}): PlannedEntry => ({
  id: row.id,
  description: row.description,
  amount: minorUnitsToNumber(row.amount),
  currency: row.currency,
  date: dateToIsoDate(row.date),
});

// What the attention block reads, besides the accounts (those come from the "Por cuenta" read): the
// planned expenses up to ATTENTION_DAYS_AHEAD days from today (the overdue ones of any earlier month
// too), the planned incomes dated before today, the expenses with a reimbursement still outstanding,
// and the cards with their usage in today's month. The date of an expense is the one the app shows
// (for a card charge, the day the statement is paid). The four reads are independent, so they run
// together, and every one is scoped by userId.
export const readAttentionSources = async (
  userId: string,
  today: string,
): Promise<AttentionReads> => {
  const [expenses, incomes, reimbursements, cards] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId,
        status: "PLANNED",
        date: { lte: isoDateToDate(addDays(today, ATTENTION_DAYS_AHEAD)) },
      },
      select: PLANNED_SELECT,
      orderBy: OLDEST_FIRST,
    }),
    prisma.income.findMany({
      where: { userId, status: "PLANNED", date: { lt: isoDateToDate(today) } },
      select: PLANNED_SELECT,
      orderBy: OLDEST_FIRST,
    }),
    listReimbursableExpenses(userId),
    listCards(userId, monthOf(today)),
  ]);

  return {
    plannedExpenses: expenses.map(toPlanned),
    plannedIncomes: incomes.map(toPlanned),
    reimbursements,
    cards,
  };
};
```

Run: `npx vitest run core/summary/attentionSources.test.ts`
Expected: PASS. (The test compares `select` against an object without `as const`: `toHaveBeenCalledWith` compares values, so it matches.)

- [ ] **Step 7: Verify the task boundary**

Run: `npx vitest run core/summary`, `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto core/summary/charts.ts core/summary/charts.test.ts core/summary/attentionSources.ts core/summary/attentionSources.test.ts`.
Expected: all green. Nothing imports the two new modules yet: the running page is unchanged.

- [ ] **Step 8: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 3: Rows for the client and the loader (tab rows, attention and charts that fail alone)

**Files:**

- Modify: `components/Summary/types.ts`, `components/Summary/consts.ts`, `components/Summary/utils.ts`, `components/Summary/utils.test.ts`
- Modify (fixtures that build a `SummaryRow`, see Step 1): `components/Summary/Summary.test.tsx`, `components/Summary/components/CurrencySection/utils.test.ts`
- Modify: `app/dashboard/overview/loadSummaryView.ts`, `app/dashboard/overview/loadSummaryView.test.ts`
- Modify: `app/dashboard/overview/page.tsx` (passes `today`)

**Interfaces:**

- Consumes: Task 1 (`buildAttention`, `buildMonthCharts`, `summariesForTabs`, `addDays`, `formatShortMonth`, `ATTENTION_DAYS_AHEAD`, all the types); Task 2 (`readMonthChartSources`, `readAttentionSources`); `formatMoney` (`core/incomes/money.ts`); `formatIncomeDate`, `formatShortDate` (`core/incomes/dates.ts`); `compareCurrencyCodes` (`core/currencies/crypto.ts`); `DEFAULT_ENTRIES_QUERY`, `serializeEntriesQuery`, `parseEntriesQuery` (tests) (`core/entries/query.ts`); `EXPENSES_PATH` (`core/expenses/consts.ts`); `INCOMES_PATH` (`core/incomes/consts.ts`); `BANKS_PATH` (`core/banks/consts.ts`); `CARDS_PATH` (`core/cards/consts.ts`); the existing `toSummaryRows`, `toAccountRows`, `toOpeningBalanceData`, `listAccountBalanceRows`, `groupAccountBalances`, `getMonthlySummary`, `getUserSettings`, `getOpeningBalanceEditorData`.
- Produces:
  - `components/Summary/types.ts`: `SummaryRow.paidPercent: number`; `BlockResult<T>`; `MonthlyChartRow`, `CategoryChartRow`, `DailyChartPoint`, `CurrencyChartsRow`; `AttentionItemRow`, `AttentionGroupRow` (exact shapes in Step 3).
  - `components/Summary/consts.ts`: `CURRENCY_PARAM = "currency"`, `ATTENTION_COPY: Readonly<Record<AttentionKind, { title: string; linkLabel: string }>>`, `OTHER_CATEGORY_KEY = "other"`; `EMPTY_ROWS` gains `paidPercent: 0`.
  - `components/Summary/utils.ts`: `paidPercentOf(side: SideSummary): number`, `toSummaryRows` (adds `paidPercent`), `attentionHref(kind: AttentionKind, today: string): string`, `toAttentionRows(groups: readonly AttentionGroup[], today: string): AttentionGroupRow[]`, `toChartRows(charts: MonthCharts): CurrencyChartsRow[]`, `settleBlock<T>(promise: Promise<T>): Promise<BlockResult<T>>`.
  - `loadSummaryView(userId: string, month: string, today: string)` returning `{ summary: Promise<SummaryRow[]>, includeExpectedIncomes: Promise<boolean>, openingBalance: Promise<OpeningBalanceData>, accountBalances: Promise<CurrencyAccountsRow[]>, attention: Promise<BlockResult<AttentionGroupRow[]>>, charts: Promise<BlockResult<CurrencyChartsRow[]>> }`.

Existing tests and fixtures this task breaks, and what happens to each (pre-flight, `rg -n "SummaryRow|loadSummaryView|toSummaryRows|EMPTY_ROWS" components app`):

- `components/Summary/utils.test.ts` "formats every amount in its own currency": its exact `toEqual` gains `paidPercent: 60` (30000 of 50000 paid). Same strength, one more field.
- `components/Summary/Summary.test.tsx` fixtures `ARS` and `USD` (typed `SummaryRow`): gain `paidPercent: 60` and `paidPercent: 0`. No test body changes in this task.
- `components/Summary/components/CurrencySection/utils.test.ts` fixture `ROW` (typed `SummaryRow`): gains `paidPercent: 60`. No test body changes.
- `components/Summary/consts.ts` `EMPTY_ROWS` (typed): gains `paidPercent: 0`.
- `app/dashboard/overview/loadSummaryView.test.ts`: every call `loadSummaryView("user_1", "<month>")` gains a third argument `TODAY` (13 tests, bodies otherwise unchanged); two more `vi.mock`s (`@/core/summary/charts`, `@/core/summary/attentionSources`) with resolved defaults in `beforeEach`.
- `app/dashboard/overview/page.tsx` passes `today`.

- [ ] **Step 1: Update the fixtures that build a summary row (they will not compile once the type grows)**

In `components/Summary/Summary.test.tsx`, add `paidPercent: 60,` after `reimbursements: "$ 40,00",` in `ARS`, and `paidPercent: 0,` after `reimbursements: "US$ 0,00",` in `USD`.
In `components/Summary/components/CurrencySection/utils.test.ts`, add `paidPercent: 60,` after `reimbursements: "reimbursements",` in `ROW`.

- [ ] **Step 2: Write the failing mapping tests**

In `components/Summary/utils.test.ts`:

- change the import line to
  `import { attentionHref, paidPercentOf, settleBlock, toAccountRows, toAttentionRows, toChartRows, toOpeningBalanceData, toSummaryRows } from "./utils";`
  and add `import { parseEntriesQuery } from "@/core/entries/query";` and `import type { AttentionGroup, MonthCharts } from "@/core/summary/types";`;
- in "formats every amount in its own currency", add `paidPercent: 60,` after `reimbursements: money("$ 4.000,00"),`;
- append:

```ts
describe("paidPercentOf", () => {
  it("is the share of the total already paid, rounded", () => {
    expect(
      paidPercentOf({ total: 50000, settled: 30000, pending: 20000 }),
    ).toBe(60);
    expect(paidPercentOf({ total: 3, settled: 1, pending: 2 })).toBe(33);
  });

  it("is 0 with nothing to pay, never a division by zero", () => {
    expect(paidPercentOf({ total: 0, settled: 0, pending: 0 })).toBe(0);
  });

  it("never goes past 100", () => {
    expect(paidPercentOf({ total: 100, settled: 150, pending: -50 })).toBe(100);
  });
});

describe("toChartRows", () => {
  const CHARTS: MonthCharts = {
    monthly: [
      {
        currency: "USDC",
        months: [{ month: "2026-09", incomes: 1500000, expenses: 0 }],
      },
      {
        currency: "ARS",
        months: [{ month: "2026-09", incomes: 140000, expenses: 50000 }],
      },
    ],
    categories: [
      {
        currency: "ARS",
        total: 50000,
        categories: [
          { categoryId: "cat_food", name: "Comida", amount: 30000 },
          { categoryId: null, name: "Otras", amount: 20000 },
        ],
      },
    ],
    daily: [
      {
        currency: "ARS",
        points: [
          { date: "2026-09-01", balance: -100 },
          { date: "2026-09-02", balance: 500000 },
        ],
      },
    ],
  };

  it("gives each currency one row, in the app's order, with every chart of it", () => {
    const rows = toChartRows(CHARTS);

    expect(rows.map(({ currency }) => currency)).toEqual(["ARS", "USDC"]);
    expect(rows[1].categories).toEqual([]);
    expect(rows[1].daily).toEqual([]);
  });

  it("formats every label in the row's own currency, crypto included", () => {
    const [ars, usdc] = toChartRows(CHARTS);

    expect(ars.monthly[0]).toEqual({
      month: "2026-09",
      monthLabel: expect.stringMatching(/^sep/i),
      incomes: 140000,
      expenses: 50000,
      incomesLabel: money("$ 1.400,00"),
      expensesLabel: money("$ 500,00"),
    });
    expect(usdc.monthly[0].incomesLabel).toEqual(money("1,50 USDC"));
  });

  it("names each category bar, gives it its share of the total, and marks Otras", () => {
    const [ars] = toChartRows(CHARTS);

    expect(ars.categories).toEqual([
      {
        key: "cat_food",
        name: "Comida",
        amount: 30000,
        amountLabel: money("$ 300,00"),
        shareLabel: "60 %",
        isOther: false,
      },
      {
        key: "other",
        name: "Otras",
        amount: 20000,
        amountLabel: money("$ 200,00"),
        shareLabel: "40 %",
        isOther: true,
      },
    ]);
  });

  it("writes each day short and marks a negative balance", () => {
    const [ars] = toChartRows(CHARTS);

    expect(ars.daily[0]).toEqual({
      date: "2026-09-01",
      dayLabel: "01/09",
      balance: -100,
      balanceLabel: expect.stringMatching(/-.*1,00/),
      isNegative: true,
    });
    expect(ars.daily[1].isNegative).toBe(false);
  });
});

describe("attentionHref", () => {
  const TODAY = "2026-10-08";

  it("sends expenses to the planned ones up to a week ahead, with no lower date", () => {
    expect(attentionHref("overdueExpense", TODAY)).toBe(
      "/dashboard/expenses?to=2026-10-15&status=PLANNED",
    );
    expect(attentionHref("upcomingExpense", TODAY)).toBe(
      "/dashboard/expenses?to=2026-10-15&status=PLANNED",
    );
  });

  it("sends overdue incomes to the planned ones up to yesterday", () => {
    expect(attentionHref("overdueIncome", TODAY)).toBe(
      "/dashboard/incomes?to=2026-10-07&status=PLANNED",
    );
  });

  it("sends the kinds without a filter to their plain page", () => {
    expect(attentionHref("reimbursement", TODAY)).toBe("/dashboard/incomes");
    expect(attentionHref("negativeAccount", TODAY)).toBe("/dashboard/banks");
    expect(attentionHref("cardLimit", TODAY)).toBe("/dashboard/cards");
  });

  it("every expense and income link parses back into the target page's filter", () => {
    const parse = (href: string) =>
      parseEntriesQuery(
        Object.fromEntries(new URLSearchParams(href.split("?")[1])),
        { today: TODAY },
      );

    expect(parse(attentionHref("overdueExpense", TODAY))).toMatchObject({
      status: "PLANNED",
      from: null,
      to: "2026-10-15",
      currency: null,
      categoryId: null,
    });
    expect(parse(attentionHref("overdueIncome", TODAY))).toMatchObject({
      status: "PLANNED",
      from: null,
      to: "2026-10-07",
    });
  });
});

describe("toAttentionRows", () => {
  const GROUPS: AttentionGroup[] = [
    {
      kind: "overdueExpense",
      hiddenCount: 2,
      items: [
        {
          kind: "overdueExpense",
          id: "e1",
          title: "Luz",
          currency: "ARS",
          amount: 150000,
          limit: null,
          date: "2026-10-01",
          severity: "danger",
        },
      ],
    },
    {
      kind: "cardLimit",
      hiddenCount: 0,
      items: [
        {
          kind: "cardLimit",
          id: "card_1:USD",
          title: "Visa •••• 1234 · Banco Galicia",
          currency: "USD",
          amount: 8500,
          limit: 10000,
          date: null,
          severity: "warning",
        },
      ],
    },
  ];

  it("titles each group, links it to where it is resolved, and keeps the count of the rest", () => {
    const [expenses, cards] = toAttentionRows(GROUPS, "2026-10-08");

    expect(expenses).toMatchObject({
      kind: "overdueExpense",
      title: "Gastos vencidos",
      linkLabel: "Ver gastos",
      href: "/dashboard/expenses?to=2026-10-15&status=PLANNED",
      hiddenCount: 2,
    });
    expect(cards).toMatchObject({
      kind: "cardLimit",
      title: "Tarjetas cerca del tope",
      linkLabel: "Ver Tarjetas",
      href: "/dashboard/cards",
    });
  });

  it("formats each amount in its own currency, with the date of an entry and the cap of a card", () => {
    const [expenses, cards] = toAttentionRows(GROUPS, "2026-10-08");

    expect(expenses.items[0]).toEqual({
      id: "e1",
      title: "Luz",
      amountLabel: money("$ 1.500,00"),
      limitLabel: null,
      dateLabel: expect.stringMatching(/2026/),
      severity: "danger",
    });
    expect(cards.items[0]).toEqual({
      id: "card_1:USD",
      title: "Visa •••• 1234 · Banco Galicia",
      amountLabel: money("US$ 85,00"),
      limitLabel: money("US$ 100,00"),
      dateLabel: null,
      severity: "warning",
    });
  });
});

describe("settleBlock", () => {
  it("hands the value on when the load works", async () => {
    await expect(settleBlock(Promise.resolve([1]))).resolves.toEqual({
      status: "ok",
      value: [1],
    });
  });

  it("turns a failure into an error result instead of rejecting", async () => {
    await expect(
      settleBlock(Promise.reject(new Error("database down"))),
    ).resolves.toEqual({ status: "error" });
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run components/Summary/utils.test.ts`
Expected: FAIL (`paidPercentOf`, `toChartRows`, `attentionHref`, `toAttentionRows`, `settleBlock` are not exported; the `toSummaryRows` row has no `paidPercent`).

- [ ] **Step 4: Write the types, the copy and the mappings**

In `components/Summary/types.ts`, add `import type { AttentionKind, AttentionSeverity } from "@/core/summary/types";` at the top; in `interface SummaryRow`, after `reimbursements: string;`, add:

```ts
// What share of the expenses' total is already paid, 0..100 (the bar under Gastos).
paidPercent: number;
```

and append:

```ts
// A block of the page that loads on its own: when its read fails the page shows a short error in its
// place instead of going down.
export type BlockResult<T> = { status: "ok"; value: T } | { status: "error" };

// One month of the income-against-expenses chart: the amounts for the geometry, the labels for the text.
export interface MonthlyChartRow {
  month: string;
  monthLabel: string;
  incomes: number;
  expenses: number;
  incomesLabel: string;
  expensesLabel: string;
}

// One bar of the category chart.
export interface CategoryChartRow {
  key: string;
  name: string;
  amount: number;
  amountLabel: string;
  // "45 %": its share of the month's expenses.
  shareLabel: string;
  // The bar that folds the smallest categories ("Otras").
  isOther: boolean;
}

// One day of the balance chart.
export interface DailyChartPoint {
  date: string;
  // "08/10".
  dayLabel: string;
  balance: number;
  balanceLabel: string;
  isNegative: boolean;
}

// The three charts of one currency.
export interface CurrencyChartsRow {
  currency: string;
  monthly: MonthlyChartRow[];
  categories: CategoryChartRow[];
  daily: DailyChartPoint[];
}

// A line of the attention block, every amount already formatted in its own currency.
export interface AttentionItemRow {
  id: string;
  title: string;
  amountLabel: string;
  // The cap of a card ("usado X de Y"); null for everything else.
  limitLabel: string | null;
  // When it is due or was dated; null for accounts and cards.
  dateLabel: string | null;
  severity: AttentionSeverity;
}

// A group of the attention block: what it is, where it is resolved and its lines.
export interface AttentionGroupRow {
  kind: AttentionKind;
  title: string;
  linkLabel: string;
  href: string;
  items: AttentionItemRow[];
  hiddenCount: number;
}
```

In `components/Summary/consts.ts`, add `import type { AttentionKind } from "@/core/summary/types";`, add `paidPercent: 0,` after `reimbursements: ZERO,` in `EMPTY_ROWS`, and append:

```ts
// The address parameter of the currency tab the month block shows (`?currency=USD`). ARS, the
// default, is never written.
export const CURRENCY_PARAM = "currency";

// The key of the "Otras" bar of the category chart (it folds several categories, so it has no id).
export const OTHER_CATEGORY_KEY = "other";

// What each group of the attention block is called and what its link says.
export const ATTENTION_COPY: Readonly<
  Record<AttentionKind, { title: string; linkLabel: string }>
> = {
  overdueExpense: { title: "Gastos vencidos", linkLabel: "Ver gastos" },
  negativeAccount: { title: "Cuentas en negativo", linkLabel: "Ver Bancos" },
  cardLimit: { title: "Tarjetas cerca del tope", linkLabel: "Ver Tarjetas" },
  upcomingExpense: {
    title: "Gastos de los próximos 7 días",
    linkLabel: "Ver gastos",
  },
  overdueIncome: { title: "Ingresos atrasados", linkLabel: "Ver ingresos" },
  reimbursement: { title: "Reintegros pendientes", linkLabel: "Ver ingresos" },
};
```

In `components/Summary/utils.ts`:

- extend the imports:

```ts
import { BANKS_PATH } from "@/core/banks/consts";
import { CARDS_PATH } from "@/core/cards/consts";
import { compareCurrencyCodes } from "@/core/currencies/crypto";
import {
  DEFAULT_ENTRIES_QUERY,
  serializeEntriesQuery,
} from "@/core/entries/query";
import { EXPENSES_PATH } from "@/core/expenses/consts";
import { INCOMES_PATH } from "@/core/incomes/consts";
import { formatIncomeDate, formatShortDate } from "@/core/incomes/dates";
import { ATTENTION_DAYS_AHEAD } from "@/core/summary/consts";
import { addDays } from "@/core/summary/days";
import { formatShortMonth } from "@/core/summary/month";
import type {
  AttentionGroup,
  AttentionKind,
  MonthCharts,
} from "@/core/summary/types";
```

and add `ATTENTION_COPY, OTHER_CATEGORY_KEY` from `./consts` and `AttentionGroupRow, BlockResult, CurrencyChartsRow` to the `./types` import;

- add, before `toSummaryRows`:

```ts
// What share of the expenses' total is already paid, rounded, 0..100; 0 when there is nothing to pay.
export const paidPercentOf = ({ total, settled }: SideSummary): number =>
  total <= 0
    ? 0
    : Math.min(100, Math.max(0, Math.round((settled * 100) / total)));
```

- in `toSummaryRows`, after `reimbursements: formatMoney(pendingReimbursements, currency),` add `paidPercent: paidPercentOf(expenses),`;
- append:

```ts
// Where each group of the attention block is resolved. Expenses and incomes open their list on the
// planned ones, with no lower date (the overdue ones of earlier months show too) and the upper date of
// the rule; the kinds without a filter open their plain page.
export const attentionHref = (kind: AttentionKind, today: string): string => {
  switch (kind) {
    case "overdueExpense":
    case "upcomingExpense":
      return `${EXPENSES_PATH}${serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        status: "PLANNED",
        to: addDays(today, ATTENTION_DAYS_AHEAD),
      })}`;
    case "overdueIncome":
      return `${INCOMES_PATH}${serializeEntriesQuery({
        ...DEFAULT_ENTRIES_QUERY,
        status: "PLANNED",
        to: addDays(today, -1),
      })}`;
    case "reimbursement":
      return INCOMES_PATH;
    case "negativeAccount":
      return BANKS_PATH;
    default:
      return CARDS_PATH;
  }
};

// The attention block's rows: money formatted on the server, in each item's own currency.
export const toAttentionRows = (
  groups: readonly AttentionGroup[],
  today: string,
): AttentionGroupRow[] =>
  groups.map(({ kind, items, hiddenCount }) => ({
    kind,
    title: ATTENTION_COPY[kind].title,
    linkLabel: ATTENTION_COPY[kind].linkLabel,
    href: attentionHref(kind, today),
    hiddenCount,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      amountLabel: formatMoney(item.amount, item.currency),
      limitLabel:
        item.limit === null ? null : formatMoney(item.limit, item.currency),
      dateLabel: item.date === null ? null : formatIncomeDate(item.date),
      severity: item.severity,
    })),
  }));

const shareOf = (amount: number, total: number): string =>
  `${total <= 0 ? 0 : Math.round((amount * 100) / total)} %`;

// The charts' rows, one per currency that has any chart data, in the app's order. Every label is
// formatted here, in the row's own currency (crypto never goes through Intl as a currency).
export const toChartRows = ({
  monthly,
  categories,
  daily,
}: MonthCharts): CurrencyChartsRow[] => {
  const currencies = [
    ...new Set(
      [...monthly, ...categories, ...daily].map(({ currency }) => currency),
    ),
  ].sort(compareCurrencyCodes);

  return currencies.map((currency) => {
    const months =
      monthly.find((row) => row.currency === currency)?.months ?? [];
    const breakdown = categories.find((row) => row.currency === currency);
    const points = daily.find((row) => row.currency === currency)?.points ?? [];

    return {
      currency,
      monthly: months.map((row) => ({
        month: row.month,
        monthLabel: formatShortMonth(row.month),
        incomes: row.incomes,
        expenses: row.expenses,
        incomesLabel: formatMoney(row.incomes, currency),
        expensesLabel: formatMoney(row.expenses, currency),
      })),
      categories: (breakdown?.categories ?? []).map((row) => ({
        key: row.categoryId ?? OTHER_CATEGORY_KEY,
        name: row.name,
        amount: row.amount,
        amountLabel: formatMoney(row.amount, currency),
        shareLabel: shareOf(row.amount, breakdown?.total ?? 0),
        isOther: row.categoryId === null,
      })),
      daily: points.map((point) => ({
        date: point.date,
        dayLabel: formatShortDate(point.date),
        balance: point.balance,
        balanceLabel: formatMoney(point.balance, currency),
        isNegative: point.balance < 0,
      })),
    };
  });
};

// A block's promise that never rejects: a failure becomes `{ status: "error" }`, so the page shows a
// short error in that block and everything else stays on screen.
export const settleBlock = <T>(promise: Promise<T>): Promise<BlockResult<T>> =>
  promise.then(
    (value): BlockResult<T> => ({ status: "ok", value }),
    (): BlockResult<T> => ({ status: "error" }),
  );
```

`SideSummary` is already imported in `utils.ts` (`import type { CurrencySummary, SideSummary } from "@/core/summary/types";`): merge `AttentionGroup, AttentionKind, MonthCharts` into that same import instead of a second one.

Run: `npx vitest run components/Summary/utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing loader tests**

In `app/dashboard/overview/loadSummaryView.test.ts`:

- after the existing `vi.hoisted` lines add:

```ts
const chartReads = vi.hoisted(() => ({ readMonthChartSources: vi.fn() }));
const attentionReads = vi.hoisted(() => ({ readAttentionSources: vi.fn() }));
```

and after the existing `vi.mock` lines add:

```ts
vi.mock("@/core/summary/charts", () => chartReads);
vi.mock("@/core/summary/attentionSources", () => attentionReads);
```

- after the imports add `import { toSummaryRows } from "@/components/Summary/utils";` and the constants:

```ts
const TODAY = "2026-09-15";

const NO_CHART_ROWS = {
  incomes: [],
  expenses: [],
  categories: [],
  categoryNames: [],
};

const NO_ATTENTION_ROWS = {
  plannedExpenses: [],
  plannedIncomes: [],
  reimbursements: [],
  cards: [],
};
```

- in `beforeEach`, add:

```ts
chartReads.readMonthChartSources.mockReset();
attentionReads.readAttentionSources.mockReset();
chartReads.readMonthChartSources.mockResolvedValue(NO_CHART_ROWS);
attentionReads.readAttentionSources.mockResolvedValue(NO_ATTENTION_ROWS);
```

- in every existing test, change `loadSummaryView("user_1", "2026-09")` to `loadSummaryView("user_1", "2026-09", TODAY)` and `loadSummaryView("user_1", "2026-03")` to `loadSummaryView("user_1", "2026-03", TODAY)` (13 tests; nothing else in them changes);
- in "returns at once, without waiting for the data", after the three `mockReturnValue(new Promise(() => {}))` lines add `chartReads.readMonthChartSources.mockReturnValue(new Promise(() => {}));` and `attentionReads.readAttentionSources.mockReturnValue(new Promise(() => {}));`, and after the last `expect` add `expect(view.attention).toBeInstanceOf(Promise);` and `expect(view.charts).toBeInstanceOf(Promise);`;
- append, inside `describe("loadSummaryView", …)`:

```ts
it("keeps every figure of a currency exactly as the month's summary computes it (the tabs only add zero rows)", async () => {
  const USD = { ...ARS, currency: "USD", previous: 1, current: 2 };

  service.getMonthlySummary.mockResolvedValue([ARS, USD]);

  await expect(
    loadSummaryView("user_1", "2026-09", TODAY).summary,
  ).resolves.toEqual(toSummaryRows([ARS, USD]));
});

it("gives a currency the user holds an account in a tab at zero, after ARS", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);
  accounts.listAccountBalanceRows.mockResolvedValue([
    {
      accountId: "a2",
      accountName: "Dólares",
      bankId: "b1",
      bankName: "Galicia",
      currency: "USD",
      balance: 0,
      archived: false,
    },
  ]);

  const rows = await loadSummaryView("user_1", "2026-09", TODAY).summary;

  expect(rows.map(({ currency }) => currency)).toEqual(["ARS", "USD"]);
  expect(rows[0]).toEqual(toSummaryRows([ARS])[0]);
  expect(rows[1].incomes.total).toMatch(/0,00/);
  expect(rows[1].paidPercent).toBe(0);
});

it("reads the attention as of today and the charts of the month, for the user", async () => {
  service.getMonthlySummary.mockResolvedValue([]);

  const view = loadSummaryView("user_1", "2026-09", TODAY);

  await Promise.all([view.attention, view.charts]);

  expect(attentionReads.readAttentionSources).toHaveBeenCalledWith(
    "user_1",
    TODAY,
  );
  expect(chartReads.readMonthChartSources).toHaveBeenCalledWith(
    "user_1",
    "2026-09",
  );
});

it("builds the attention groups from the reads and the accounts, with their links", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);
  attentionReads.readAttentionSources.mockResolvedValue({
    ...NO_ATTENTION_ROWS,
    plannedExpenses: [
      {
        id: "e1",
        description: "Luz",
        currency: "ARS",
        amount: 150000,
        date: "2026-09-10",
      },
    ],
  });
  accounts.listAccountBalanceRows.mockResolvedValue([
    {
      accountId: "a1",
      accountName: "Caja",
      bankId: "b1",
      bankName: "Galicia",
      currency: "ARS",
      balance: -5000,
      archived: false,
    },
  ]);

  await expect(
    loadSummaryView("user_1", "2026-09", TODAY).attention,
  ).resolves.toEqual({
    status: "ok",
    value: [
      expect.objectContaining({
        kind: "overdueExpense",
        href: "/dashboard/expenses?to=2026-09-22&status=PLANNED",
      }),
      expect.objectContaining({ kind: "negativeAccount" }),
    ],
  });
});

it("gives no attention group when nothing needs it", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);

  await expect(
    loadSummaryView("user_1", "2026-09", TODAY).attention,
  ).resolves.toEqual({ status: "ok", value: [] });
});

it("attention fails alone: an error result, while the month's numbers still arrive", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);
  attentionReads.readAttentionSources.mockRejectedValue(new Error("boom"));

  const view = loadSummaryView("user_1", "2026-09", TODAY);

  await expect(view.attention).resolves.toEqual({ status: "error" });
  await expect(view.summary).resolves.toHaveLength(1);
});

it("attention fails when the accounts cannot be read, while 'Por cuenta' just has no rows", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);
  accounts.listAccountBalanceRows.mockRejectedValue(new Error("boom"));

  const view = loadSummaryView("user_1", "2026-09", TODAY);

  await expect(view.attention).resolves.toEqual({ status: "error" });
  await expect(view.accountBalances).resolves.toEqual([]);
  await expect(view.summary).resolves.toHaveLength(1);
});

it("builds the charts per currency, the daily line starting at the month's Saldo previo", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);
  chartReads.readMonthChartSources.mockResolvedValue({
    ...NO_CHART_ROWS,
    incomes: [
      {
        currency: "ARS",
        date: new Date("2026-09-10T00:00:00.000Z"),
        status: "SETTLED",
        _sum: { amount: BigInt(100000) },
      },
    ],
  });

  const result = await loadSummaryView("user_1", "2026-09", TODAY).charts;

  if (result.status !== "ok") {
    throw new Error("the charts should have loaded");
  }

  const [ars] = result.value;

  expect(ars.currency).toBe("ARS");
  expect(ars.monthly.map(({ month }) => month)).toEqual(["2026-09"]);
  // From the 1st up to today, the 15th.
  expect(ars.daily).toHaveLength(15);
  expect(ars.daily[8].balance).toBe(500000);
  expect(ars.daily[9].balance).toBe(600000);
});

it("charts fail alone: an error result, while the month's numbers still arrive", async () => {
  service.getMonthlySummary.mockResolvedValue([ARS]);
  chartReads.readMonthChartSources.mockRejectedValue(new Error("boom"));

  const view = loadSummaryView("user_1", "2026-09", TODAY);

  await expect(view.charts).resolves.toEqual({ status: "error" });
  await expect(view.summary).resolves.toHaveLength(1);
});

it("charts give an error result, not a rejection, when the month's summary fails", async () => {
  service.getMonthlySummary.mockRejectedValue(new Error("database down"));

  const view = loadSummaryView("user_1", "2026-09", TODAY);

  await expect(view.charts).resolves.toEqual({ status: "error" });
  await expect(view.summary).rejects.toThrow("database down");
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run app/dashboard/overview/loadSummaryView.test.ts`
Expected: FAIL (`view.attention` / `view.charts` are undefined; the account-only USD tab is missing; the readers are never called).

- [ ] **Step 7: Write the loader and pass `today` from the page**

Replace the whole of `app/dashboard/overview/loadSummaryView.ts` with:

```ts
import {
  settleBlock,
  toAccountRows,
  toAttentionRows,
  toChartRows,
  toOpeningBalanceData,
  toSummaryRows,
} from "@/components/Summary/utils";
import { getOpeningBalanceEditorData } from "@/core/balances/service";
import { getUserSettings } from "@/core/settings/service";
import { buildAttention } from "@/core/summary/attention";
import { readAttentionSources } from "@/core/summary/attentionSources";
import { listAccountBalanceRows } from "@/core/summary/byAccount";
import { readMonthChartSources } from "@/core/summary/charts";
import { groupAccountBalances } from "@/core/summary/groupAccounts";
import { buildMonthCharts } from "@/core/summary/series";
import { getMonthlySummary } from "@/core/summary/service";
import { summariesForTabs } from "@/core/summary/tabs";

// Starts loading every block of the overview and returns at once, without awaiting them: the page
// hands the promises straight to the client component, so its structure renders first and each block
// waits for its own numbers.
//
// The promises are created here, once per request, so their identity is stable: a client component
// that waits on them gets the same promise on every render.
//
// Isolation: the attention block and the charts never reject (a `BlockResult`), so a failing read
// shows a short error in that block only; "Por cuenta" has no rows when its read fails, as before; the
// month's numbers reject as before, which reaches the page's error boundary.
export const loadSummaryView = (
  userId: string,
  month: string,
  today: string,
) => {
  // Read once: the target remainder depends on it, and the switch that changes it shows it. The
  // switch gets its own promise, so it appears as soon as the setting is read instead of waiting for
  // the month's numbers.
  const settings = getUserSettings(userId);
  const monthSummary = settings.then(({ includeExpectedIncomes }) =>
    getMonthlySummary(userId, month, { includeExpectedIncomes }),
  );

  // What each account holds today: read once for "Por cuenta", the currency tabs and the attention
  // block (negative accounts). Independent of the month and of the settings, so it starts at once.
  const accountRows = listAccountBalanceRows(userId);
  const accountGroups = accountRows.then(groupAccountBalances);
  const accountCurrencies = accountGroups.then(
    (groups) => groups.map(({ currency }) => currency),
    (): string[] => [],
  );

  return {
    // One row per currency tab: the month's own, plus a row at zero for a currency held in an account.
    summary: Promise.all([monthSummary, accountCurrencies]).then(
      ([rows, currencies]) => toSummaryRows(summariesForTabs(rows, currencies)),
    ),
    includeExpectedIncomes: settings.then(
      ({ includeExpectedIncomes }) => includeExpectedIncomes,
    ),
    openingBalance:
      getOpeningBalanceEditorData(userId).then(toOpeningBalanceData),
    accountBalances: accountGroups.then(toAccountRows).catch(() => []),
    attention: settleBlock(
      Promise.all([readAttentionSources(userId, today), accountRows]).then(
        ([reads, accounts]) =>
          toAttentionRows(buildAttention({ ...reads, accounts, today }), today),
      ),
    ),
    charts: settleBlock(
      Promise.all([readMonthChartSources(userId, month), monthSummary]).then(
        ([sources, rows]) =>
          toChartRows(buildMonthCharts(sources, rows, month, today)),
      ),
    ),
  };
};
```

In `app/dashboard/overview/page.tsx`, replace the body from `const currentMonth = monthOf(todayIso());` up to the `loadSummaryView(userId, month);` line with:

```tsx
// "Today" is the Argentine calendar date: it decides the month in course (what the summary shows
// when the address asks for no month, and what a bad month falls back to) and what needs attention.
const today = todayIso();
const currentMonth = monthOf(today);
const month = parseMonthParam((await searchParams)[MONTH_PARAM], currentMonth);

// Not awaited on purpose: the database work starts here and streams in behind the page, so the
// header is on screen at once and only the cards wait for their numbers.
const { summary, openingBalance, includeExpectedIncomes, accountBalances } =
  loadSummaryView(userId, month, today);
```

(The page still renders the old `Summary` with the same four props; `attention` and `charts` are created and settle unused until Task 7, and they never reject.)

Run: `npx vitest run app/dashboard/overview/loadSummaryView.test.ts components/Summary`
Expected: PASS (the 13 existing loader tests and the new ones; every existing Summary component test unchanged).

- [ ] **Step 8: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts lib/auth/routeProtection.test.ts`, `npx prettier --check --end-of-line auto components/Summary/types.ts components/Summary/consts.ts components/Summary/utils.ts components/Summary/utils.test.ts components/Summary/Summary.test.tsx components/Summary/components/CurrencySection/utils.test.ts app/dashboard/overview/loadSummaryView.ts app/dashboard/overview/loadSummaryView.test.ts app/dashboard/overview/page.tsx`.
Expected: all green. The running page shows the same sections as before plus, for a currency held only in an account, one more section at zero.

- [ ] **Step 9: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 4: The charts (SVG and HTML, a tooltip, a table view, keyboard access)

Read first: `.heroui-docs/react/components/(buttons)/button.mdx`, `.heroui-docs/react/components/(overlays)/tooltip.mdx` (to see why the charts draw their own tooltip: HeroUI's needs one trigger per mark and a focusable trigger element, which an SVG `<g>` cannot be through `Tooltip.Trigger`), `.heroui-docs/react/components/(feedback)/skeleton.mdx`. Copy: the button markup of `components/Summary/components/MonthSelector/MonthSelector.tsx` (`Button variant="tertiary"`), the flat card look of `components/shared/MetricCard/styles.ts` (`ring-1 ring-inset ring-border`, `rounded-2xl`), the colour tokens of `components/Summary/components/CardRow/styles.ts` (incomes `success`, expenses `warning`) and the bar of `components/Cards/components/CardsTable/components/UsageCell/` as the visual precedent.

**Files:**

- Create: `components/Summary/components/Charts/{Charts.tsx,Charts.test.tsx,index.ts,types.ts,consts.ts,styles.ts,utils.ts,utils.test.ts}`
- Create: `components/Summary/components/Charts/components/ChartFrame/{ChartFrame.tsx,ChartFrame.test.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Summary/components/Charts/components/MonthlyChart/{MonthlyChart.tsx,MonthlyChart.test.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Summary/components/Charts/components/CategoriesChart/{CategoriesChart.tsx,CategoriesChart.test.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Summary/components/Charts/components/DailyBalanceChart/{DailyBalanceChart.tsx,DailyBalanceChart.test.tsx,index.ts,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: `CurrencyChartsRow`, `MonthlyChartRow`, `CategoryChartRow`, `DailyChartPoint` (Task 3, `components/Summary/types.ts`); `Button` (`@heroui/react`); `cn` (`lib/utils/utils`).
- Produces:
  - `Charts({ row }: ChartsProps)` with `ChartsProps { row: CurrencyChartsRow }`.
  - `ChartFrame({ title, legend, table, isEmpty, emptyText, children }: ChartFrameProps)`; `ChartLegendItem { label: string; swatchClassName: string }`; `ChartTable { columns: readonly string[]; rows: readonly { key: string; cells: readonly string[] }[] }`.
  - `MonthlyChart({ currency, months })`, `CategoriesChart({ currency, categories })`, `DailyBalanceChart({ currency, points })`.
  - `Charts/utils.ts`: `scale(value, min, max, start, end): number`, `barLength(value, max, length): number`, `linePath(points: readonly { x: number; y: number }[]): string`, `extentOf(values: readonly number[]): { min: number; max: number }`, `clampIndex(index: number, length: number): number`.
  - `Charts/consts.ts`: `chartAriaLabel(title: string, currency: string): string`.

- [ ] **Step 1: Write the failing geometry tests**

Create `components/Summary/components/Charts/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { barLength, clampIndex, extentOf, linePath, scale } from "./utils";

describe("scale", () => {
  it("maps a value of the domain onto the range, in either direction", () => {
    expect(scale(5, 0, 10, 0, 100)).toBe(50);
    expect(scale(0, 0, 10, 200, 0)).toBe(200);
    expect(scale(10, 0, 10, 200, 0)).toBe(0);
  });

  it("puts every value of a flat domain in the middle", () => {
    expect(scale(7, 7, 7, 0, 100)).toBe(50);
  });
});

describe("barLength", () => {
  it("is proportional to the largest value", () => {
    expect(barLength(50, 200, 100)).toBe(25);
    expect(barLength(200, 200, 100)).toBe(100);
  });

  it("is 0 for nothing, a negative value or an empty chart", () => {
    expect(barLength(0, 200, 100)).toBe(0);
    expect(barLength(-5, 200, 100)).toBe(0);
    expect(barLength(5, 0, 100)).toBe(0);
  });
});

describe("linePath", () => {
  it("moves to the first point and draws a line through the others, rounded to a tenth", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5.04, y: 2.06 },
        { x: 10, y: 0 },
      ]),
    ).toBe("M0 10 L5 2.1 L10 0");
  });

  it("is empty without points", () => {
    expect(linePath([])).toBe("");
  });
});

describe("extentOf", () => {
  it("gives the lowest and the highest value", () => {
    expect(extentOf([3, -2, 9])).toEqual({ min: -2, max: 9 });
  });

  it("is zero to zero without values", () => {
    expect(extentOf([])).toEqual({ min: 0, max: 0 });
  });
});

describe("clampIndex", () => {
  it("keeps an index inside the list", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
    expect(clampIndex(5, 3)).toBe(2);
  });
});
```

Run: `npx vitest run components/Summary/components/Charts/utils.test.ts`
Expected: FAIL (`Failed to resolve import "./utils"`).

- [ ] **Step 2: Write the geometry**

Create `components/Summary/components/Charts/utils.ts`:

```ts
// The geometry of the charts. Pure: it only maps numbers onto the drawing.

// Maps `value` of [min, max] onto [start, end] (end may be smaller: an SVG's y grows downwards). A flat
// domain puts every value in the middle.
export const scale = (
  value: number,
  min: number,
  max: number,
  start: number,
  end: number,
): number =>
  max === min
    ? (start + end) / 2
    : start + ((value - min) / (max - min)) * (end - start);

// How long a bar is, from its baseline, when the largest value takes `length`.
export const barLength = (
  value: number,
  max: number,
  length: number,
): number =>
  max <= 0 || value <= 0 ? 0 : (Math.min(value, max) / max) * length;

const round = (value: number): number => Math.round(value * 10) / 10;

// An SVG path through the points, in order.
export const linePath = (points: readonly { x: number; y: number }[]): string =>
  points
    .map(
      ({ x, y }, index) => `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`,
    )
    .join(" ");

export const extentOf = (
  values: readonly number[],
): { min: number; max: number } =>
  values.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...values), max: Math.max(...values) };

export const clampIndex = (index: number, length: number): number =>
  Math.min(Math.max(index, 0), length - 1);
```

Create `components/Summary/components/Charts/consts.ts`:

```ts
// The name of a chart for assistive technology: what it shows and in which currency.
export const chartAriaLabel = (title: string, currency: string): string =>
  `${title}, en ${currency}`;
```

Run: `npx vitest run components/Summary/components/Charts/utils.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing frame tests**

Create `components/Summary/components/Charts/components/ChartFrame/ChartFrame.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartFrame } from "./ChartFrame";
import type { ChartFrameProps } from "./types";

const TABLE: ChartFrameProps["table"] = {
  columns: ["Mes", "Ingresos"],
  rows: [
    { key: "2026-08", cells: ["ago 26", "$ 10,00"] },
    { key: "2026-09", cells: ["sep 26", "$ 20,00"] },
  ],
};

const LEGEND: ChartFrameProps["legend"] = [
  { label: "Ingresos", swatchClassName: "bg-success" },
  { label: "Gastos", swatchClassName: "bg-warning" },
];

const renderFrame = (patch: Partial<ChartFrameProps> = {}) =>
  render(
    <ChartFrame
      title="Ingresos y gastos"
      legend={LEGEND}
      table={TABLE}
      isEmpty={false}
      emptyText="Nada todavía."
      {...patch}
    >
      <svg data-testid="drawing" />
    </ChartFrame>,
  );

describe("ChartFrame", () => {
  it("is a region named by its title, with the drawing in it", () => {
    renderFrame();

    const region = screen.getByRole("region", { name: "Ingresos y gastos" });

    expect(
      within(region).getByRole("heading", {
        level: 3,
        name: "Ingresos y gastos",
      }),
    ).toBeInTheDocument();
    expect(within(region).getByTestId("drawing")).toBeInTheDocument();
  });

  it("shows the same numbers as a table on request, and goes back to the drawing", () => {
    renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    const table = screen.getByRole("table", { name: "Ingresos y gastos" });

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Mes", "Ingresos"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("$ 20,00")).toBeInTheDocument();
    expect(screen.queryByTestId("drawing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver como gráfico" }));

    expect(screen.getByTestId("drawing")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("has a legend with a swatch and a word for each series when there are two or more", () => {
    renderFrame();

    const legend = screen.getByRole("list", { name: "Referencias" });

    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Ingresos", "Gastos"]);
  });

  it("has no legend for a single series: the title names it", () => {
    renderFrame({ legend: [LEGEND[0]] });

    expect(
      screen.queryByRole("list", { name: "Referencias" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("drawing")).toBeInTheDocument();
  });

  it("says why it is empty, with no drawing, no legend and no table toggle", () => {
    renderFrame({ isEmpty: true });

    expect(screen.getByText("Nada todavía.")).toBeInTheDocument();
    expect(screen.queryByTestId("drawing")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver como tabla" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Referencias" }),
    ).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/Summary/components/Charts/components/ChartFrame`
Expected: FAIL (`Failed to resolve import "./ChartFrame"`).

- [ ] **Step 4: Write the frame**

Create `components/Summary/components/Charts/components/ChartFrame/types.ts`:

```ts
import type { ReactNode } from "react";

// One series of the legend: its word and the class that paints its swatch (a theme token).
export interface ChartLegendItem {
  label: string;
  swatchClassName: string;
}

// The same numbers as the drawing, as text: one row per mark.
export interface ChartTable {
  columns: readonly string[];
  rows: readonly { key: string; cells: readonly string[] }[];
}

export interface ChartFrameProps {
  title: string;
  // Shown only with two or more series.
  legend: readonly ChartLegendItem[];
  table: ChartTable;
  // Nothing to draw: the frame shows `emptyText` instead.
  isEmpty: boolean;
  emptyText: string;
  // The drawing.
  children: ReactNode;
}
```

Create `.../ChartFrame/consts.ts`:

```ts
export const SHOW_TABLE_LABEL = "Ver como tabla";
export const SHOW_CHART_LABEL = "Ver como gráfico";
export const LEGEND_LABEL = "Referencias";
```

Create `.../ChartFrame/styles.ts`:

```ts
// A flat card like the metric cards: a ring instead of a shadow.
export const ROOT_CLASS_NAME =
  "flex min-w-0 flex-col gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset ring-border";

export const HEADER_CLASS_NAME = "flex items-center justify-between gap-2";

export const TITLE_CLASS_NAME = "text-sm font-semibold";

export const LEGEND_CLASS_NAME = "flex flex-wrap gap-3 text-xs text-muted";

export const LEGEND_ITEM_CLASS_NAME = "inline-flex items-center gap-1.5";

export const SWATCH_CLASS_NAME = "size-2.5 shrink-0 rounded-sm";

export const EMPTY_CLASS_NAME = "text-sm text-muted";

export const TABLE_CLASS_NAME = "w-full text-sm tabular-nums";

export const CAPTION_CLASS_NAME = "sr-only";

export const HEAD_CELL_CLASS_NAME =
  "pb-1 pr-3 text-left text-xs font-medium text-muted";

export const CELL_CLASS_NAME = "py-1 pr-3";
```

Create `.../ChartFrame/ChartFrame.tsx`:

```tsx
"use client";

import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils/utils";

import { LEGEND_LABEL, SHOW_CHART_LABEL, SHOW_TABLE_LABEL } from "./consts";
import {
  CAPTION_CLASS_NAME,
  CELL_CLASS_NAME,
  EMPTY_CLASS_NAME,
  HEAD_CELL_CLASS_NAME,
  HEADER_CLASS_NAME,
  LEGEND_CLASS_NAME,
  LEGEND_ITEM_CLASS_NAME,
  ROOT_CLASS_NAME,
  SWATCH_CLASS_NAME,
  TABLE_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { ChartFrameProps } from "./types";

// What every chart shares: its title, a legend when it has two series or more, and a toggle that shows
// the same numbers as a table, so nothing is only in the drawing.
export function ChartFrame({
  title,
  legend,
  table,
  isEmpty,
  emptyText,
  children,
}: ChartFrameProps) {
  const [showsTable, setShowsTable] = useState(false);

  let body: ReactNode = children;

  if (showsTable) {
    body = (
      <table className={TABLE_CLASS_NAME}>
        <caption className={CAPTION_CLASS_NAME}>{title}</caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column} scope="col" className={HEAD_CELL_CLASS_NAME}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={table.columns[index]} className={CELL_CLASS_NAME}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (isEmpty) {
    body = <p className={EMPTY_CLASS_NAME}>{emptyText}</p>;
  }

  return (
    <section className={ROOT_CLASS_NAME} aria-label={title}>
      <div className={HEADER_CLASS_NAME}>
        <h3 className={TITLE_CLASS_NAME}>{title}</h3>
        {isEmpty ? null : (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setShowsTable((current) => !current)}
          >
            {showsTable ? SHOW_CHART_LABEL : SHOW_TABLE_LABEL}
          </Button>
        )}
      </div>
      {legend.length > 1 && !isEmpty ? (
        <ul className={LEGEND_CLASS_NAME} aria-label={LEGEND_LABEL}>
          {legend.map((item) => (
            <li key={item.label} className={LEGEND_ITEM_CLASS_NAME}>
              <span
                className={cn(SWATCH_CLASS_NAME, item.swatchClassName)}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {body}
    </section>
  );
}
```

Create `.../ChartFrame/index.ts`:

```ts
export { ChartFrame } from "./ChartFrame";
export type { ChartFrameProps, ChartLegendItem, ChartTable } from "./types";
```

Run: `npx vitest run components/Summary/components/Charts/components/ChartFrame`
Expected: PASS. If the HeroUI `Button` has no `size="sm"` in `button.mdx`, drop the prop (the test does not depend on it).

- [ ] **Step 5: Write the failing monthly chart tests**

Create `.../MonthlyChart/MonthlyChart.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MonthlyChartRow } from "../../../../types";
import { MonthlyChart } from "./MonthlyChart";

const MONTHS: MonthlyChartRow[] = [
  {
    month: "2026-08",
    monthLabel: "ago 26",
    incomes: 100,
    expenses: 50,
    incomesLabel: "$ 1,00",
    expensesLabel: "$ 0,50",
  },
  {
    month: "2026-09",
    monthLabel: "sep 26",
    incomes: 200,
    expenses: 0,
    incomesLabel: "$ 2,00",
    expensesLabel: "$ 0,00",
  },
];

const bar = (month: string, series: "incomes" | "expenses") =>
  document.querySelector(
    `[data-month="${month}"] [data-series="${series}"]`,
  ) as SVGRectElement;

describe("MonthlyChart", () => {
  it("is named after what it shows and the currency", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(
      screen.getByRole("group", {
        name: "Ingresos y gastos de los últimos 6 meses, en ARS",
      }),
    ).toBeInTheDocument();
  });

  it("draws two bars per month, as tall as their share of the largest amount, with the theme's colours", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    const tallest = Number(bar("2026-09", "incomes").getAttribute("height"));

    expect(tallest).toBeGreaterThan(0);
    expect(
      Number(bar("2026-08", "incomes").getAttribute("height")),
    ).toBeCloseTo(tallest / 2);
    expect(
      Number(bar("2026-08", "expenses").getAttribute("height")),
    ).toBeCloseTo(tallest / 4);
    expect(Number(bar("2026-09", "expenses").getAttribute("height"))).toBe(0);
    expect(bar("2026-08", "incomes")).toHaveClass("fill-success");
    expect(bar("2026-08", "expenses")).toHaveClass("fill-warning");
  });

  it("names each month under its bars", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(screen.getByText("ago 26")).toBeInTheDocument();
    expect(screen.getByText("sep 26")).toBeInTheDocument();
  });

  it("has a legend for its two series", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(screen.getByRole("list", { name: "Referencias" })).toHaveTextContent(
      "IngresosGastos",
    );
  });

  it("shows a month's amounts in a tooltip on hover, and hides it when the pointer leaves", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    const august = screen.getByLabelText(
      "ago 26: ingresos $ 1,00, gastos $ 0,50",
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(august);

    expect(screen.getByRole("tooltip")).toHaveTextContent("ago 26");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Ingresos: $ 1,00");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Gastos: $ 0,50");

    fireEvent.mouseLeave(august);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reaches every month with the keyboard, the tooltip following the focus", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    const september = screen.getByLabelText(
      "sep 26: ingresos $ 2,00, gastos $ 0,00",
    );

    expect(september).toHaveAttribute("tabindex", "0");

    fireEvent.focus(september);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Ingresos: $ 2,00");
  });

  it("lists the same numbers in its table", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(screen.getByRole("table")).toHaveTextContent("sep 26$ 2,00$ 0,00");
  });

  it("says there is nothing yet when no month has anything", () => {
    render(<MonthlyChart currency="ARS" months={[]} />);

    expect(
      screen.getByText("Todavía no hay ingresos ni gastos en estos meses."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/Summary/components/Charts/components/MonthlyChart`
Expected: FAIL (`Failed to resolve import "./MonthlyChart"`).

- [ ] **Step 6: Write the monthly chart**

Create `.../MonthlyChart/types.ts`:

```ts
import type { MonthlyChartRow } from "../../../../types";

export interface MonthlyChartProps {
  currency: string;
  // Oldest first.
  months: readonly MonthlyChartRow[];
}
```

Create `.../MonthlyChart/styles.ts`:

```ts
export const WRAPPER_CLASS_NAME = "relative";

export const SVG_CLASS_NAME = "h-auto w-full overflow-visible";

// The tooltip sits in the chart's top-right corner, above the bars.
export const TOOLTIP_CLASS_NAME =
  "pointer-events-none absolute top-0 right-0 z-10 flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2 text-xs shadow-md ring-1 ring-border";

export const TOOLTIP_TITLE_CLASS_NAME = "font-semibold";

export const BASELINE_CLASS_NAME = "stroke-border";

// The month under the pointer or the focus gets a faint band, so it is clear which one the tooltip is about.
export const GROUP_CLASS_NAME =
  "outline-none [&:focus-visible>rect:first-child]:fill-surface-secondary [&:hover>rect:first-child]:fill-surface-secondary";

export const HIT_CLASS_NAME = "fill-transparent";

// Incomes the cool colour, expenses the warm one, as in the cards above the charts.
export const INCOME_BAR_CLASS_NAME = "fill-success";

export const EXPENSE_BAR_CLASS_NAME = "fill-warning";

export const AXIS_TEXT_CLASS_NAME = "fill-muted text-[11px]";

export const INCOME_SWATCH_CLASS_NAME = "bg-success";

export const EXPENSE_SWATCH_CLASS_NAME = "bg-warning";
```

Create `.../MonthlyChart/consts.ts`:

```ts
import type { MonthlyChartRow } from "../../../../types";
import type { ChartLegendItem } from "../ChartFrame";
import { EXPENSE_SWATCH_CLASS_NAME, INCOME_SWATCH_CLASS_NAME } from "./styles";

export const MONTHLY_TITLE = "Ingresos y gastos de los últimos 6 meses";
export const MONTHLY_EMPTY =
  "Todavía no hay ingresos ni gastos en estos meses.";

export const INCOMES_LABEL = "Ingresos";
export const EXPENSES_LABEL = "Gastos";

export const MONTHLY_COLUMNS: readonly string[] = [
  "Mes",
  INCOMES_LABEL,
  EXPENSES_LABEL,
];

export const MONTHLY_LEGEND: readonly ChartLegendItem[] = [
  { label: INCOMES_LABEL, swatchClassName: INCOME_SWATCH_CLASS_NAME },
  { label: EXPENSES_LABEL, swatchClassName: EXPENSE_SWATCH_CLASS_NAME },
];

// The drawing's own units (the SVG scales to its width).
export const VIEW_WIDTH = 600;
export const VIEW_HEIGHT = 220;
export const PLOT_TOP = 12;
export const PLOT_BOTTOM = 190;
export const LABEL_Y = 210;
export const BAR_WIDTH = 18;
// The 2px gap between the two bars of a month.
export const BAR_GAP = 2;
export const BAR_RADIUS = 2;

export const monthAriaLabel = ({
  monthLabel,
  incomesLabel,
  expensesLabel,
}: MonthlyChartRow): string =>
  `${monthLabel}: ingresos ${incomesLabel}, gastos ${expensesLabel}`;
```

Create `.../MonthlyChart/MonthlyChart.tsx`:

```tsx
"use client";

import { useState } from "react";

import { chartAriaLabel } from "../../consts";
import { barLength } from "../../utils";
import { ChartFrame } from "../ChartFrame";
import {
  BAR_GAP,
  BAR_RADIUS,
  BAR_WIDTH,
  EXPENSES_LABEL,
  INCOMES_LABEL,
  LABEL_Y,
  monthAriaLabel,
  MONTHLY_COLUMNS,
  MONTHLY_EMPTY,
  MONTHLY_LEGEND,
  MONTHLY_TITLE,
  PLOT_BOTTOM,
  PLOT_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./consts";
import {
  AXIS_TEXT_CLASS_NAME,
  BASELINE_CLASS_NAME,
  EXPENSE_BAR_CLASS_NAME,
  GROUP_CLASS_NAME,
  HIT_CLASS_NAME,
  INCOME_BAR_CLASS_NAME,
  SVG_CLASS_NAME,
  TOOLTIP_CLASS_NAME,
  TOOLTIP_TITLE_CLASS_NAME,
  WRAPPER_CLASS_NAME,
} from "./styles";
import type { MonthlyChartProps } from "./types";

// Income against expenses of the last months, one currency: two thin bars per month from one
// baseline, one axis, the months named under them. Hover or focus a month for its amounts.
export function MonthlyChart({ currency, months }: MonthlyChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(
    0,
    ...months.flatMap(({ incomes, expenses }) => [incomes, expenses]),
  );
  const slot = VIEW_WIDTH / Math.max(months.length, 1);
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const activeRow = active === null ? undefined : months[active];

  return (
    <ChartFrame
      title={MONTHLY_TITLE}
      legend={MONTHLY_LEGEND}
      isEmpty={months.length === 0}
      emptyText={MONTHLY_EMPTY}
      table={{
        columns: MONTHLY_COLUMNS,
        rows: months.map((row) => ({
          key: row.month,
          cells: [row.monthLabel, row.incomesLabel, row.expensesLabel],
        })),
      }}
    >
      <div className={WRAPPER_CLASS_NAME}>
        {activeRow ? (
          <div role="tooltip" className={TOOLTIP_CLASS_NAME}>
            <span className={TOOLTIP_TITLE_CLASS_NAME}>
              {activeRow.monthLabel}
            </span>
            <span>
              {INCOMES_LABEL}: {activeRow.incomesLabel}
            </span>
            <span>
              {EXPENSES_LABEL}: {activeRow.expensesLabel}
            </span>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className={SVG_CLASS_NAME}
          role="group"
          aria-label={chartAriaLabel(MONTHLY_TITLE, currency)}
        >
          <line
            x1={0}
            x2={VIEW_WIDTH}
            y1={PLOT_BOTTOM}
            y2={PLOT_BOTTOM}
            className={BASELINE_CLASS_NAME}
          />
          {months.map((row, index) => {
            const center = slot * index + slot / 2;
            const incomeHeight = barLength(row.incomes, max, plotHeight);
            const expenseHeight = barLength(row.expenses, max, plotHeight);

            return (
              <g
                key={row.month}
                data-month={row.month}
                tabIndex={0}
                role="img"
                aria-label={monthAriaLabel(row)}
                className={GROUP_CLASS_NAME}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                <rect
                  x={slot * index}
                  y={PLOT_TOP}
                  width={slot}
                  height={plotHeight}
                  className={HIT_CLASS_NAME}
                />
                <rect
                  data-series="incomes"
                  x={center - BAR_WIDTH - BAR_GAP / 2}
                  y={PLOT_BOTTOM - incomeHeight}
                  width={BAR_WIDTH}
                  height={incomeHeight}
                  rx={BAR_RADIUS}
                  className={INCOME_BAR_CLASS_NAME}
                />
                <rect
                  data-series="expenses"
                  x={center + BAR_GAP / 2}
                  y={PLOT_BOTTOM - expenseHeight}
                  width={BAR_WIDTH}
                  height={expenseHeight}
                  rx={BAR_RADIUS}
                  className={EXPENSE_BAR_CLASS_NAME}
                />
                <text
                  x={center}
                  y={LABEL_Y}
                  textAnchor="middle"
                  className={AXIS_TEXT_CLASS_NAME}
                >
                  {row.monthLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartFrame>
  );
}
```

Note: the month label is inside the focusable `<g>`, whose `aria-label` already says it, so the text is a visual direct label; `getByText("ago 26")` still finds it.

Create `.../MonthlyChart/index.ts`:

```ts
export { MonthlyChart } from "./MonthlyChart";
```

Run: `npx vitest run components/Summary/components/Charts/components/MonthlyChart`
Expected: PASS.

- [ ] **Step 7: Write the failing category chart tests**

Create `.../CategoriesChart/CategoriesChart.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CategoryChartRow } from "../../../../types";
import { CategoriesChart } from "./CategoriesChart";

const LONG_NAME =
  "Supermercado y almacén del barrio con un nombre larguísimo que no entra";

const CATEGORIES: CategoryChartRow[] = [
  {
    key: "cat_food",
    name: LONG_NAME,
    amount: 300,
    amountLabel: "$ 3,00",
    shareLabel: "60 %",
    isOther: false,
  },
  {
    key: "other",
    name: "Otras",
    amount: 150,
    amountLabel: "$ 1,50",
    shareLabel: "30 %",
    isOther: true,
  },
];

describe("CategoriesChart", () => {
  it("lists the categories in the order given, each with its amount, named after the chart and the currency", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const list = screen.getByRole("list", {
      name: "Gastos por categoría, en ARS",
    });
    const rows = within(list).getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("$ 3,00");
    expect(rows[1]).toHaveTextContent("Otras");
  });

  it("makes each bar as long as its share of the largest, Otras in the muted colour", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const bars = document.querySelectorAll<HTMLElement>("[data-bar]");

    expect(bars).toHaveLength(2);
    expect(bars[0].style.width).toBe("100%");
    expect(bars[1].style.width).toBe("50%");
    expect(bars[0]).toHaveClass("bg-warning");
    expect(bars[1]).toHaveClass("bg-muted");
  });

  it("cuts a long name and keeps its full text as a title", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    expect(screen.getByText(LONG_NAME)).toHaveAttribute("title", LONG_NAME);
    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });

  it("shows the share of the total in a tooltip on hover and on focus", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const others = screen.getByLabelText("Otras: $ 1,50 (30 % del total)");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(others);
    expect(screen.getByRole("tooltip")).toHaveTextContent("30 % del total");

    fireEvent.mouseLeave(others);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(others);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Otras");
  });

  it("lists the same numbers in its table", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(screen.getByRole("table")).toHaveTextContent("Otras$ 1,5030 %");
  });

  it("says there are no expenses in the month when there is nothing to draw", () => {
    render(<CategoriesChart currency="ARS" categories={[]} />);

    expect(screen.getByText("No hay gastos en este mes.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/Summary/components/Charts/components/CategoriesChart`
Expected: FAIL (`Failed to resolve import "./CategoriesChart"`).

- [ ] **Step 8: Write the category chart**

Create `.../CategoriesChart/types.ts`:

```ts
import type { CategoryChartRow } from "../../../../types";

export interface CategoriesChartProps {
  currency: string;
  // Largest first, "Otras" last.
  categories: readonly CategoryChartRow[];
}
```

Create `.../CategoriesChart/styles.ts`:

```ts
export const LIST_CLASS_NAME = "flex flex-col gap-2";

// Name, bar and amount on one line; the name gives way first.
export const ROW_CLASS_NAME =
  "relative grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

export const NAME_CLASS_NAME = "truncate";

export const TRACK_CLASS_NAME = "block h-2 rounded-full bg-surface-secondary";

// Expenses keep their warm colour; "Otras" is muted so it never reads as one more category.
export const BAR_CLASS_NAME = "block h-2 rounded-full bg-warning";

export const OTHER_BAR_CLASS_NAME = "block h-2 rounded-full bg-muted";

export const AMOUNT_CLASS_NAME = "tabular-nums";

export const TOOLTIP_CLASS_NAME =
  "pointer-events-none absolute -top-8 right-0 z-10 rounded-lg bg-surface px-2 py-1 text-xs shadow-md ring-1 ring-border";
```

Create `.../CategoriesChart/consts.ts`:

```ts
import type { CategoryChartRow } from "../../../../types";

export const CATEGORIES_TITLE = "Gastos por categoría";
export const CATEGORIES_EMPTY = "No hay gastos en este mes.";

export const CATEGORIES_COLUMNS: readonly string[] = [
  "Categoría",
  "Monto",
  "Del total",
];

// "Comida: $ 3,00 (60 % del total)": what a row says to assistive technology and in its tooltip.
export const categoryAriaLabel = ({
  name,
  amountLabel,
  shareLabel,
}: CategoryChartRow): string =>
  `${name}: ${amountLabel} (${shareLabel} del total)`;
```

Create `.../CategoriesChart/CategoriesChart.tsx`:

```tsx
"use client";

import { useState } from "react";

import { chartAriaLabel } from "../../consts";
import { barLength } from "../../utils";
import { ChartFrame } from "../ChartFrame";
import {
  categoryAriaLabel,
  CATEGORIES_COLUMNS,
  CATEGORIES_EMPTY,
  CATEGORIES_TITLE,
} from "./consts";
import {
  AMOUNT_CLASS_NAME,
  BAR_CLASS_NAME,
  LIST_CLASS_NAME,
  NAME_CLASS_NAME,
  OTHER_BAR_CLASS_NAME,
  ROW_CLASS_NAME,
  TOOLTIP_CLASS_NAME,
  TRACK_CLASS_NAME,
} from "./styles";
import type { CategoriesChartProps } from "./types";

// The month's expenses by category, one currency: horizontal bars, largest first, each named and with
// its amount beside it. Hover or focus a row for its share of the total.
export function CategoriesChart({
  currency,
  categories,
}: CategoriesChartProps) {
  const [active, setActive] = useState<string | null>(null);

  const max = Math.max(0, ...categories.map(({ amount }) => amount));

  return (
    <ChartFrame
      title={CATEGORIES_TITLE}
      legend={[]}
      isEmpty={categories.length === 0}
      emptyText={CATEGORIES_EMPTY}
      table={{
        columns: CATEGORIES_COLUMNS,
        rows: categories.map((category) => ({
          key: category.key,
          cells: [category.name, category.amountLabel, category.shareLabel],
        })),
      }}
    >
      <ul
        className={LIST_CLASS_NAME}
        aria-label={chartAriaLabel(CATEGORIES_TITLE, currency)}
      >
        {categories.map((category) => (
          <li
            key={category.key}
            tabIndex={0}
            aria-label={categoryAriaLabel(category)}
            className={ROW_CLASS_NAME}
            onMouseEnter={() => setActive(category.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(category.key)}
            onBlur={() => setActive(null)}
          >
            <span className={NAME_CLASS_NAME} title={category.name}>
              {category.name}
            </span>
            <span className={TRACK_CLASS_NAME} aria-hidden="true">
              <span
                data-bar
                className={
                  category.isOther ? OTHER_BAR_CLASS_NAME : BAR_CLASS_NAME
                }
                style={{ width: `${barLength(category.amount, max, 100)}%` }}
              />
            </span>
            <span className={AMOUNT_CLASS_NAME}>{category.amountLabel}</span>
            {active === category.key ? (
              <span role="tooltip" className={TOOLTIP_CLASS_NAME}>
                {categoryAriaLabel(category)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
```

Create `.../CategoriesChart/index.ts`:

```ts
export { CategoriesChart } from "./CategoriesChart";
```

Run: `npx vitest run components/Summary/components/Charts/components/CategoriesChart`
Expected: PASS.

- [ ] **Step 9: Write the failing daily balance tests**

Create `.../DailyBalanceChart/DailyBalanceChart.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DailyChartPoint } from "../../../../types";
import { DailyBalanceChart } from "./DailyBalanceChart";

const POINTS: DailyChartPoint[] = [
  {
    date: "2026-09-01",
    dayLabel: "01/09",
    balance: 1000,
    balanceLabel: "$ 10,00",
    isNegative: false,
  },
  {
    date: "2026-09-02",
    dayLabel: "02/09",
    balance: -500,
    balanceLabel: "-$ 5,00",
    isNegative: true,
  },
  {
    date: "2026-09-03",
    dayLabel: "03/09",
    balance: 2000,
    balanceLabel: "$ 20,00",
    isNegative: false,
  },
];

const chart = () =>
  screen.getByRole("img", { name: /^Saldo día a día, en ARS/ });

describe("DailyBalanceChart", () => {
  it("draws one line through every day, named after the chart and the currency", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    const line = document.querySelector("path[data-line]");

    expect(chart()).toBeInTheDocument();
    expect(line?.getAttribute("d")?.match(/[ML]/g)).toHaveLength(3);
  });

  it("draws the zero line only when the balance crosses it", () => {
    const { unmount } = render(
      <DailyBalanceChart currency="ARS" points={POINTS} />,
    );

    expect(document.querySelector("[data-zero-line]")).not.toBeNull();

    unmount();
    render(
      <DailyBalanceChart
        currency="ARS"
        points={POINTS.filter(({ isNegative }) => !isNegative)}
      />,
    );

    expect(document.querySelector("[data-zero-line]")).toBeNull();
  });

  it("names the highest, the lowest and the last day under the line, a negative one in the danger colour", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(
      screen.getByText("Máximo $ 20,00 · Mínimo -$ 5,00"),
    ).toBeInTheDocument();
    expect(screen.getByText("03/09: $ 20,00")).not.toHaveClass("text-danger");
  });

  it("shows the last day in the danger colour when it ends below zero", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS.slice(0, 2)} />);

    expect(screen.getByText("02/09: -$ 5,00")).toHaveClass("text-danger");
  });

  it("shows a day's balance in a tooltip when the pointer is over it", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(
      document.querySelector('[data-day="2026-09-02"]') as Element,
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent("02/09: -$ 5,00");
  });

  it("walks the days with the arrow keys and closes with Escape", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(chart()).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("01/09: $ 10,00");

    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("02/09");

    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("01/09");

    fireEvent.keyDown(chart(), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("starts from the last day when the first key is ArrowLeft", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    fireEvent.keyDown(chart(), { key: "ArrowLeft" });

    expect(screen.getByRole("tooltip")).toHaveTextContent("03/09");
  });

  it("lists every day in its table", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("says the month has not started when there is no day to show", () => {
    render(<DailyBalanceChart currency="ARS" points={[]} />);

    expect(
      screen.getByText("El mes todavía no empezó: no hay saldos para mostrar."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/Summary/components/Charts/components/DailyBalanceChart`
Expected: FAIL (`Failed to resolve import "./DailyBalanceChart"`).

- [ ] **Step 10: Write the daily balance chart**

Create `.../DailyBalanceChart/types.ts`:

```ts
import type { DailyChartPoint } from "../../../../types";

export interface DailyBalanceChartProps {
  currency: string;
  // One per day, first to last.
  points: readonly DailyChartPoint[];
}
```

Create `.../DailyBalanceChart/styles.ts`:

```ts
export const WRAPPER_CLASS_NAME = "relative flex flex-col gap-2";

export const SVG_CLASS_NAME =
  "h-auto w-full overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent";

export const TOOLTIP_CLASS_NAME =
  "pointer-events-none absolute top-0 right-0 z-10 rounded-lg bg-surface px-3 py-2 text-xs shadow-md ring-1 ring-border";

// A thin line in the accent colour; the zero line recessive and dashed.
export const LINE_CLASS_NAME = "fill-none stroke-accent [stroke-width:2]";

export const ZERO_LINE_CLASS_NAME = "stroke-border [stroke-dasharray:4_4]";

export const HIT_CLASS_NAME = "fill-transparent";

export const CROSSHAIR_CLASS_NAME = "stroke-border";

export const DOT_CLASS_NAME = "fill-accent";

export const NEGATIVE_DOT_CLASS_NAME = "fill-danger";

export const CAPTION_CLASS_NAME =
  "flex flex-wrap justify-between gap-2 text-xs text-muted";

export const LAST_CLASS_NAME = "font-medium text-foreground tabular-nums";

export const NEGATIVE_LAST_CLASS_NAME = "font-medium text-danger tabular-nums";
```

Create `.../DailyBalanceChart/consts.ts`:

```ts
import type { DailyChartPoint } from "../../../../types";
import { chartAriaLabel } from "../../consts";

export const DAILY_TITLE = "Saldo día a día";
export const DAILY_EMPTY =
  "El mes todavía no empezó: no hay saldos para mostrar.";

export const DAILY_COLUMNS: readonly string[] = ["Día", "Saldo"];

export const VIEW_WIDTH = 600;
export const VIEW_HEIGHT = 200;
export const PLOT_LEFT = 8;
export const PLOT_RIGHT = 592;
export const PLOT_TOP = 12;
export const PLOT_BOTTOM = 188;
export const DOT_RADIUS = 4;

// What the chart is and how to walk it with the keyboard.
export const dailyAriaLabel = (currency: string): string =>
  `${chartAriaLabel(DAILY_TITLE, currency)}. Usá las flechas para recorrer los días.`;

// "02/09: -$ 5,00".
export const pointText = ({
  dayLabel,
  balanceLabel,
}: DailyChartPoint): string => `${dayLabel}: ${balanceLabel}`;

export const rangeText = (highest: string, lowest: string): string =>
  `Máximo ${highest} · Mínimo ${lowest}`;
```

Create `.../DailyBalanceChart/DailyBalanceChart.tsx`:

```tsx
"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";

import { clampIndex, extentOf, linePath, scale } from "../../utils";
import { ChartFrame } from "../ChartFrame";
import {
  DAILY_COLUMNS,
  DAILY_EMPTY,
  DAILY_TITLE,
  dailyAriaLabel,
  DOT_RADIUS,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  pointText,
  rangeText,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./consts";
import {
  CAPTION_CLASS_NAME,
  CROSSHAIR_CLASS_NAME,
  DOT_CLASS_NAME,
  HIT_CLASS_NAME,
  LAST_CLASS_NAME,
  LINE_CLASS_NAME,
  NEGATIVE_DOT_CLASS_NAME,
  NEGATIVE_LAST_CLASS_NAME,
  SVG_CLASS_NAME,
  TOOLTIP_CLASS_NAME,
  WRAPPER_CLASS_NAME,
  ZERO_LINE_CLASS_NAME,
} from "./styles";
import type { DailyBalanceChartProps } from "./types";

// What the accounts of one currency held at the end of each day of the month: one thin line, a zero
// line when it crosses zero, and the highest, the lowest and the last day written under it. Hover a
// day, or focus the chart and use the arrow keys, for that day's balance.
export function DailyBalanceChart({
  currency,
  points,
}: DailyBalanceChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const balances = points.map(({ balance }) => balance);
  const { min, max } = extentOf(balances);
  const x = (index: number) =>
    scale(index, 0, Math.max(points.length - 1, 1), PLOT_LEFT, PLOT_RIGHT);
  const y = (value: number) => scale(value, min, max, PLOT_BOTTOM, PLOT_TOP);
  const slot = (PLOT_RIGHT - PLOT_LEFT) / Math.max(points.length, 1);
  const last = points[points.length - 1];
  const highest = points.find(({ balance }) => balance === max);
  const lowest = points.find(({ balance }) => balance === min);
  const activePoint = active === null ? undefined : points[active];

  const walk = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") {
      setActive(null);

      return;
    }

    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();

    const step = event.key === "ArrowRight" ? 1 : -1;

    setActive((current) =>
      clampIndex(
        (current ?? (step > 0 ? -1 : points.length)) + step,
        points.length,
      ),
    );
  };

  return (
    <ChartFrame
      title={DAILY_TITLE}
      legend={[]}
      isEmpty={points.length === 0}
      emptyText={DAILY_EMPTY}
      table={{
        columns: DAILY_COLUMNS,
        rows: points.map((point) => ({
          key: point.date,
          cells: [point.dayLabel, point.balanceLabel],
        })),
      }}
    >
      <div className={WRAPPER_CLASS_NAME}>
        {activePoint ? (
          <div role="tooltip" aria-live="polite" className={TOOLTIP_CLASS_NAME}>
            {pointText(activePoint)}
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className={SVG_CLASS_NAME}
          role="img"
          tabIndex={0}
          aria-label={dailyAriaLabel(currency)}
          onKeyDown={walk}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          {min < 0 && max > 0 ? (
            <line
              data-zero-line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={y(0)}
              y2={y(0)}
              className={ZERO_LINE_CLASS_NAME}
            />
          ) : null}
          <path
            data-line
            d={linePath(
              points.map((point, index) => ({
                x: x(index),
                y: y(point.balance),
              })),
            )}
            className={LINE_CLASS_NAME}
          />
          {points.map((point, index) => (
            <rect
              key={point.date}
              data-day={point.date}
              x={x(index) - slot / 2}
              y={PLOT_TOP}
              width={slot}
              height={PLOT_BOTTOM - PLOT_TOP}
              className={HIT_CLASS_NAME}
              onMouseEnter={() => setActive(index)}
            />
          ))}
          {activePoint && active !== null ? (
            <>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                className={CROSSHAIR_CLASS_NAME}
              />
              <circle
                cx={x(active)}
                cy={y(activePoint.balance)}
                r={DOT_RADIUS}
                className={
                  activePoint.isNegative
                    ? NEGATIVE_DOT_CLASS_NAME
                    : DOT_CLASS_NAME
                }
              />
            </>
          ) : null}
        </svg>
        {last && highest && lowest ? (
          <p className={CAPTION_CLASS_NAME}>
            <span>{rangeText(highest.balanceLabel, lowest.balanceLabel)}</span>
            <span
              className={
                last.isNegative ? NEGATIVE_LAST_CLASS_NAME : LAST_CLASS_NAME
              }
            >
              {pointText(last)}
            </span>
          </p>
        ) : null}
      </div>
    </ChartFrame>
  );
}
```

Create `.../DailyBalanceChart/index.ts`:

```ts
export { DailyBalanceChart } from "./DailyBalanceChart";
```

Run: `npx vitest run components/Summary/components/Charts/components/DailyBalanceChart`
Expected: PASS.

- [ ] **Step 11: Write the failing tests of the three together**

Create `components/Summary/components/Charts/Charts.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CurrencyChartsRow } from "../../types";
import { Charts } from "./Charts";

const USDC: CurrencyChartsRow = {
  currency: "USDC",
  monthly: [
    {
      month: "2026-09",
      monthLabel: "sep 26",
      incomes: 1500000,
      expenses: 0,
      incomesLabel: "1,50 USDC",
      expensesLabel: "0,00 USDC",
    },
  ],
  categories: [],
  daily: [],
};

describe("Charts", () => {
  it("shows the three charts of the currency, in order", () => {
    render(<Charts row={USDC} />);

    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Ingresos y gastos de los últimos 6 meses",
      "Gastos por categoría",
      "Saldo día a día",
    ]);
  });

  it("draws only the currency it is given, with its own labels", () => {
    render(<Charts row={USDC} />);

    expect(
      screen.getByRole("group", {
        name: "Ingresos y gastos de los últimos 6 meses, en USDC",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("sep 26: ingresos 1,50 USDC, gastos 0,00 USDC"),
    ).toBeInTheDocument();
  });

  it("keeps a chart with nothing to draw in its place, saying so", () => {
    render(<Charts row={USDC} />);

    expect(screen.getByText("No hay gastos en este mes.")).toBeInTheDocument();
    expect(
      screen.getByText("El mes todavía no empezó: no hay saldos para mostrar."),
    ).toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/Summary/components/Charts/Charts.test.tsx`
Expected: FAIL (`Failed to resolve import "./Charts"`).

- [ ] **Step 12: Write the three together**

Create `components/Summary/components/Charts/types.ts`:

```ts
import type { CurrencyChartsRow } from "../../types";

export interface ChartsProps {
  row: CurrencyChartsRow;
}
```

Create `components/Summary/components/Charts/styles.ts`:

```ts
// One column on a phone, side by side on a wide screen.
export const ROOT_CLASS_NAME = "grid gap-4 lg:grid-cols-3";
```

Create `components/Summary/components/Charts/Charts.tsx`:

```tsx
import { CategoriesChart } from "./components/CategoriesChart";
import { DailyBalanceChart } from "./components/DailyBalanceChart";
import { MonthlyChart } from "./components/MonthlyChart";
import { ROOT_CLASS_NAME } from "./styles";
import type { ChartsProps } from "./types";

// The charts of one currency, under its figures. Currencies are never drawn together.
export function Charts({ row }: ChartsProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <MonthlyChart currency={row.currency} months={row.monthly} />
      <CategoriesChart currency={row.currency} categories={row.categories} />
      <DailyBalanceChart currency={row.currency} points={row.daily} />
    </div>
  );
}
```

Create `components/Summary/components/Charts/index.ts`:

```ts
export { Charts } from "./Charts";
```

Run: `npx vitest run components/Summary/components/Charts`
Expected: PASS.

- [ ] **Step 13: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto components/Summary/components/Charts`.
Expected: all green. Nothing renders the charts yet.

- [ ] **Step 14: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 5: The "Requiere atención" block and the block error

Read first: `.heroui-docs/react/components/(layout)/card.mdx`, `.heroui-docs/react/components/(navigation)/link.mdx`, `.heroui-docs/react/components/(feedback)/alert.mdx`. Copy: the flat `Card` of `components/Summary/components/AccountsSection/components/CurrencyAccountsCard/` (`role="region"`, ring instead of shadow), the line layout of its `BankBalances` (name truncates, amount `shrink-0 tabular-nums`, `text-danger` for a negative), the `Link` of `components/Cards/components/CardFormDrawer/components/BankField/BankField.tsx`, and `components/shared/InlineAlert` for the error.

**Files:**

- Create: `components/Summary/components/AttentionSection/{AttentionSection.tsx,AttentionSection.test.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Summary/components/AttentionSection/components/AttentionGroup/{AttentionGroup.tsx,index.ts,types.ts,consts.ts,styles.ts}`
- Create: `components/Summary/components/BlockError/{BlockError.tsx,BlockError.test.tsx,index.ts,types.ts,consts.ts}`

**Interfaces:**

- Consumes: `AttentionGroupRow`, `AttentionItemRow` (Task 3); `Card`, `Link` (`@heroui/react`); `InlineAlert` (`components/shared/InlineAlert`).
- Produces: `AttentionSection({ groups }: AttentionSectionProps)` with `AttentionSectionProps { groups: readonly AttentionGroupRow[] }` (renders nothing for an empty list); `AttentionGroup({ group }: AttentionGroupProps)`; `BlockError({ retryHref }: BlockErrorProps)` with `BlockErrorProps { retryHref: string }`.

- [ ] **Step 1: Write the failing tests**

Create `components/Summary/components/AttentionSection/AttentionSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttentionGroupRow } from "../../types";
import { AttentionSection } from "./AttentionSection";

const LONG_TITLE =
  "Cuota del aire acondicionado comprado en el local del centro (3/12)";

const OVERDUE: AttentionGroupRow = {
  kind: "overdueExpense",
  title: "Gastos vencidos",
  linkLabel: "Ver gastos",
  href: "/dashboard/expenses?to=2026-10-15&status=PLANNED",
  hiddenCount: 2,
  items: [
    {
      id: "e1",
      title: LONG_TITLE,
      amountLabel: "$ 1.500,00",
      limitLabel: null,
      dateLabel: "1 oct 2026",
      severity: "danger",
    },
  ],
};

const CARDS: AttentionGroupRow = {
  kind: "cardLimit",
  title: "Tarjetas cerca del tope",
  linkLabel: "Ver Tarjetas",
  href: "/dashboard/cards",
  hiddenCount: 0,
  items: [
    {
      id: "card_1:USD",
      title: "Visa •••• 1234 · Banco Galicia",
      amountLabel: "US$ 85,00",
      limitLabel: "US$ 100,00",
      dateLabel: null,
      severity: "warning",
    },
  ],
};

describe("AttentionSection", () => {
  it("is the 'Requiere atención' section, with one group per kind in the order given", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Requiere atención" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Gastos vencidos", "Tarjetas cerca del tope"]);
  });

  it("links each group to where it is resolved", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    const overdue = screen.getByRole("group", { name: "Gastos vencidos" });
    const cards = screen.getByRole("group", {
      name: "Tarjetas cerca del tope",
    });

    expect(
      within(overdue).getByRole("link", { name: "Ver gastos" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/expenses?to=2026-10-15&status=PLANNED",
    );
    expect(
      within(cards).getByRole("link", { name: "Ver Tarjetas" }),
    ).toHaveAttribute("href", "/dashboard/cards");
  });

  it("says what each item is, when, and how much, a long name cut with its full text as a title", () => {
    render(<AttentionSection groups={[OVERDUE]} />);

    const item = within(
      screen.getByRole("group", { name: "Gastos vencidos" }),
    ).getByRole("listitem");

    expect(item).toHaveTextContent("1 oct 2026");
    expect(item).toHaveTextContent("$ 1.500,00");
    expect(within(item).getByText(LONG_TITLE)).toHaveAttribute(
      "title",
      LONG_TITLE,
    );
  });

  it("shows an overdue amount in the danger colour and a warning one in the plain text colour", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    expect(screen.getByText("$ 1.500,00")).toHaveClass("text-danger");
    expect(screen.getByText("US$ 85,00 de US$ 100,00")).not.toHaveClass(
      "text-danger",
    );
  });

  it("writes a card's usage against its cap", () => {
    render(<AttentionSection groups={[CARDS]} />);

    expect(screen.getByText("US$ 85,00 de US$ 100,00")).toBeInTheDocument();
  });

  it("counts what does not fit in a group, and says nothing when everything fits", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    expect(
      within(screen.getByRole("group", { name: "Gastos vencidos" })).getByText(
        "y 2 más",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: "Tarjetas cerca del tope" }),
      ).queryByText(/más$/),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when nothing needs attention", () => {
    const { container } = render(<AttentionSection groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

Create `components/Summary/components/BlockError/BlockError.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BlockError } from "./BlockError";

describe("BlockError", () => {
  it("says the block could not be loaded, as an alert", () => {
    render(<BlockError retryHref="/dashboard/overview?currency=USD" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
  });

  it("offers to try again on the same address", () => {
    render(<BlockError retryHref="/dashboard/overview?currency=USD" />);

    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?currency=USD",
    );
  });
});
```

Run: `npx vitest run components/Summary/components/AttentionSection components/Summary/components/BlockError`
Expected: FAIL (`Failed to resolve import "./AttentionSection"`, `"./BlockError"`).

- [ ] **Step 2: Write the attention group**

Create `components/Summary/components/AttentionSection/components/AttentionGroup/types.ts`:

```ts
import type { AttentionGroupRow } from "../../../../types";

export interface AttentionGroupProps {
  group: AttentionGroupRow;
}
```

Create `.../AttentionGroup/consts.ts`:

```ts
// "US$ 85,00 de US$ 100,00": what a card used against its cap.
export const usedOfLimit = (used: string, limit: string): string =>
  `${used} de ${limit}`;

// "y 2 más": the lines of a group that do not fit.
export const moreLabel = (count: number): string => `y ${count} más`;

// The id of a group's title, which names the group.
export const groupHeadingId = (kind: string): string => `attention-${kind}`;
```

Create `.../AttentionGroup/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-1.5";

export const HEADER_CLASS_NAME = "flex items-baseline justify-between gap-3";

export const TITLE_CLASS_NAME = "text-sm font-semibold";

export const LINK_CLASS_NAME = "shrink-0 text-sm";

export const LIST_CLASS_NAME = "flex flex-col gap-1";

export const ROW_CLASS_NAME =
  "flex items-baseline justify-between gap-3 text-sm";

// The name gives way first; the date follows it, smaller.
export const TEXT_CLASS_NAME = "flex min-w-0 items-baseline gap-2";

export const NAME_CLASS_NAME = "truncate";

export const DATE_CLASS_NAME = "shrink-0 text-xs text-muted";

export const AMOUNT_CLASS_NAME = "shrink-0 font-medium tabular-nums";

// Overdue, negative or over the cap: red, never blocked.
export const DANGER_AMOUNT_CLASS_NAME = `${AMOUNT_CLASS_NAME} text-danger`;

export const MORE_CLASS_NAME = "text-xs text-muted";
```

Create `.../AttentionGroup/AttentionGroup.tsx`:

```tsx
import { Link } from "@heroui/react";

import { groupHeadingId, moreLabel, usedOfLimit } from "./consts";
import {
  AMOUNT_CLASS_NAME,
  DANGER_AMOUNT_CLASS_NAME,
  DATE_CLASS_NAME,
  HEADER_CLASS_NAME,
  LINK_CLASS_NAME,
  LIST_CLASS_NAME,
  MORE_CLASS_NAME,
  NAME_CLASS_NAME,
  ROOT_CLASS_NAME,
  ROW_CLASS_NAME,
  TEXT_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { AttentionGroupProps } from "./types";

// One kind of thing that needs attention: its title and the link to where it is resolved, then the
// most urgent lines, each with what it is, when and how much in its own currency.
export function AttentionGroup({ group }: AttentionGroupProps) {
  const headingId = groupHeadingId(group.kind);

  return (
    <div className={ROOT_CLASS_NAME} role="group" aria-labelledby={headingId}>
      <div className={HEADER_CLASS_NAME}>
        <h3 id={headingId} className={TITLE_CLASS_NAME}>
          {group.title}
        </h3>
        <Link href={group.href} className={LINK_CLASS_NAME}>
          {group.linkLabel}
        </Link>
      </div>
      <ul className={LIST_CLASS_NAME}>
        {group.items.map((item) => (
          <li key={item.id} className={ROW_CLASS_NAME}>
            <span className={TEXT_CLASS_NAME}>
              <span className={NAME_CLASS_NAME} title={item.title}>
                {item.title}
              </span>
              {item.dateLabel ? (
                <span className={DATE_CLASS_NAME}>{item.dateLabel}</span>
              ) : null}
            </span>
            <span
              className={
                item.severity === "danger"
                  ? DANGER_AMOUNT_CLASS_NAME
                  : AMOUNT_CLASS_NAME
              }
            >
              {item.limitLabel
                ? usedOfLimit(item.amountLabel, item.limitLabel)
                : item.amountLabel}
            </span>
          </li>
        ))}
      </ul>
      {group.hiddenCount > 0 ? (
        <p className={MORE_CLASS_NAME}>{moreLabel(group.hiddenCount)}</p>
      ) : null}
    </div>
  );
}
```

Create `.../AttentionGroup/index.ts`:

```ts
export { AttentionGroup } from "./AttentionGroup";
```

- [ ] **Step 3: Write the section**

Create `components/Summary/components/AttentionSection/types.ts`:

```ts
import type { AttentionGroupRow } from "../../types";

export interface AttentionSectionProps {
  groups: readonly AttentionGroupRow[];
}
```

Create `.../AttentionSection/consts.ts`:

```ts
export const SECTION_TITLE = "Requiere atención";
```

Create `.../AttentionSection/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-3";

export const HEADING_CLASS_NAME = "text-lg font-semibold";

// A flat card like "Por cuenta": a ring instead of a shadow, tight padding.
export const CARD_CLASS_NAME =
  "w-full max-w-3xl gap-3 rounded-2xl px-4 py-3 shadow-none ring-1 ring-inset ring-border";

export const GROUPS_CLASS_NAME = "flex flex-col gap-4";
```

Create `.../AttentionSection/AttentionSection.tsx`:

```tsx
import { Card } from "@heroui/react";

import { AttentionGroup } from "./components/AttentionGroup";
import { SECTION_TITLE } from "./consts";
import {
  CARD_CLASS_NAME,
  GROUPS_CLASS_NAME,
  HEADING_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AttentionSectionProps } from "./types";

// What needs the user's attention today (and the next days), the most urgent kind first. It is not
// rendered at all when nothing applies.
export function AttentionSection({ groups }: AttentionSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby="attention-heading">
      <h2 id="attention-heading" className={HEADING_CLASS_NAME}>
        {SECTION_TITLE}
      </h2>
      <Card className={CARD_CLASS_NAME}>
        <Card.Content className={GROUPS_CLASS_NAME}>
          {groups.map((group) => (
            <AttentionGroup key={group.kind} group={group} />
          ))}
        </Card.Content>
      </Card>
    </section>
  );
}
```

Create `.../AttentionSection/index.ts`:

```ts
export { AttentionSection } from "./AttentionSection";
```

- [ ] **Step 4: Write the block error**

Create `components/Summary/components/BlockError/types.ts`:

```ts
export interface BlockErrorProps {
  // The address that loads the page again, as it is now.
  retryHref: string;
}
```

Create `.../BlockError/consts.ts`:

```ts
export const BLOCK_ERROR_MESSAGE = "No pudimos cargar esto.";
export const RETRY_LABEL = "Reintentar";
```

Create `.../BlockError/BlockError.tsx`:

```tsx
import { Link } from "@heroui/react";

import { InlineAlert } from "@/components/shared/InlineAlert";

import { BLOCK_ERROR_MESSAGE, RETRY_LABEL } from "./consts";
import type { BlockErrorProps } from "./types";

// What a block of the overview shows when its numbers could not be read: the rest of the page stays.
export function BlockError({ retryHref }: BlockErrorProps) {
  return (
    <InlineAlert variant="error">
      {BLOCK_ERROR_MESSAGE} <Link href={retryHref}>{RETRY_LABEL}</Link>
    </InlineAlert>
  );
}
```

Create `.../BlockError/index.ts`:

```ts
export { BlockError } from "./BlockError";
```

Run: `npx vitest run components/Summary/components/AttentionSection components/Summary/components/BlockError`
Expected: PASS.

- [ ] **Step 5: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto components/Summary/components/AttentionSection components/Summary/components/BlockError`.
Expected: all green. Nothing renders them yet.

- [ ] **Step 6: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 6: The month block: currency tabs, three columns and the paid bar

Read first: `.heroui-docs/react/components/(navigation)/tabs.mdx` and `.heroui-docs/react/demos/en/tabs/overflow.tsx` (the `Tabs` / `Tabs.ListContainer` / `Tabs.List aria-label` / `Tabs.Tab id` + `Tabs.Indicator` / `Tabs.Panel id` anatomy, `selectedKey` and `onSelectionChange`; `ListContainer` scrolls the tabs on a narrow screen), `.heroui-docs/react/components/(feedback)/progress-bar.mdx`, `.heroui-docs/react/components/(feedback)/skeleton.mdx`, and `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` ("Native History API"). Copy: `components/Cards/components/CardsTable/components/UsageCell/UsageCell.tsx` (the `ProgressBar` with `Track` and `Fill`), `components/Summary/components/MonthSelector/MonthSelector.tsx`, and `components/shared/Await`.

**Files:**

- Modify: `components/Summary/components/MonthSelector/utils.ts`, `utils.test.ts`, `types.ts`, `MonthSelector.tsx`, `MonthSelector.test.tsx`
- Modify: `components/Summary/components/CurrencySection/CurrencySection.tsx`, `consts.ts`, `styles.ts`
- Create: `components/Summary/components/CurrencySection/CurrencySection.test.tsx`
- Modify: `components/Summary/components/LoadingSummary/LoadingSummary.tsx`, `styles.ts`
- Create: `components/Summary/components/MonthSection/{MonthSection.tsx,MonthSection.test.tsx,index.ts,types.ts,consts.ts,styles.ts,utils.ts,utils.test.ts}`
- Create: `components/Summary/components/MonthSection/components/CurrencyPanels/{CurrencyPanels.tsx,index.ts,types.ts,consts.ts,styles.ts}`

**Interfaces:**

- Consumes: Task 3 (`SummaryRow.paidPercent`, `BlockResult`, `CurrencyChartsRow`, `CURRENCY_PARAM`, `EMPTY_ROWS`, `SUMMARY_PATH`, `MONTH_PARAM`); Task 4 (`Charts`); Task 5 (`BlockError`); `Tabs`, `ProgressBar`, `Skeleton` (`@heroui/react`); `Await`, `Source` (`components/shared/Await`); `DEFAULT_CURRENCY_CODE` (`core/incomes/consts.ts`); the existing `CardRow`, `MetricCard`, `LoadingSummary`, `MonthSelector`.
- Produces:
  - `monthHref(month: string, currentMonth: string, basePath?: string, params?: Readonly<Record<string, string>>): string`.
  - `MonthSelectorProps.params?: Readonly<Record<string, string>>`.
  - `CurrencySection` lays its rows out as three columns, with a `ProgressBar` named "Pagado del total en <CODE>" in the Gastos column; `paidLabel(currency)`, `paidText(percent)` in its `consts.ts`.
  - `MonthSection(props: MonthSectionProps)` with `MonthSectionProps { month: string; currentMonth: string; monthLabel: string; currencyParam: string | null; summary: Source<readonly SummaryRow[]>; charts: Source<BlockResult<readonly CurrencyChartsRow[]>>; aside: ReactNode; controls: ReactNode }`.
  - `CurrencyPanels(props: CurrencyPanelsProps)` with `CurrencyPanelsProps { rows: readonly SummaryRow[]; charts: Source<BlockResult<readonly CurrencyChartsRow[]>>; selected: string | null; onSelect: (currency: string) => void; retryHref: string }`.
  - `MonthSection/utils.ts`: `resolveCurrency(selected: string | null, currencies: readonly string[]): string`, `currencyParams(currency: string | null): Record<string, string>`, `chartsFor(charts: readonly CurrencyChartsRow[], currency: string): CurrencyChartsRow`.

Existing tests this task touches: none break. `MonthSelector/utils.test.ts` and `MonthSelector.test.tsx` keep every test and gain new ones; `Summary.test.tsx` keeps passing unchanged (the currency `h2` stays, visually hidden; the regions, row lists, `h3` titles and cards are the same elements).

- [ ] **Step 1: Write the failing address tests**

Append to `components/Summary/components/MonthSelector/utils.test.ts`, inside `describe("monthHref", …)`:

```ts
it("keeps the extra parameters it is given after the month", () => {
  expect(
    monthHref("2026-08", "2026-09", "/dashboard/overview", {
      currency: "USD",
    }),
  ).toBe("/dashboard/overview?month=2026-08&currency=USD");
});

it("keeps them on the bare address of the month in course", () => {
  expect(
    monthHref("2026-09", "2026-09", "/dashboard/overview", {
      currency: "USDC",
    }),
  ).toBe("/dashboard/overview?currency=USDC");
});
```

Append to `components/Summary/components/MonthSelector/MonthSelector.test.tsx`, inside the outer `describe`:

```tsx
it("keeps the currency in the address when it moves to another month", () => {
  render(
    <MonthSelector
      month="2026-08"
      label="Agosto de 2026"
      currentMonth="2026-09"
      params={{ currency: "USD" }}
    />,
  );

  press("Mes anterior");

  expect(router.push).toHaveBeenCalledWith(
    "/dashboard/overview?month=2026-07&currency=USD",
  );
});
```

Run: `npx vitest run components/Summary/components/MonthSelector`
Expected: FAIL (the extra parameters are dropped; `params` is not a prop).

- [ ] **Step 2: Write the address with extra parameters**

Replace `monthHref` in `components/Summary/components/MonthSelector/utils.ts` with:

```ts
// The address of a page for a month (the summary unless another page asks), with any other parameter
// the page keeps (the summary's currency tab). The month in course is written as no month, which is
// what the page shows without one, so there is one address for it and not two.
export const monthHref = (
  month: string,
  currentMonth: string,
  basePath: string = SUMMARY_PATH,
  params: Readonly<Record<string, string>> = {},
): string => {
  const search = new URLSearchParams(
    month === currentMonth ? {} : { [MONTH_PARAM]: month },
  );

  for (const [key, value] of Object.entries(params)) {
    search.set(key, value);
  }

  const query = search.toString();

  return query ? `${basePath}?${query}` : basePath;
};
```

In `components/Summary/components/MonthSelector/types.ts`, add to `MonthSelectorProps`:

```ts
  // Other parameters the page keeps in its address when the month changes (the summary's currency).
  params?: Readonly<Record<string, string>>;
```

In `MonthSelector.tsx`, add `params` to the destructured props and change `router.push(monthHref(target, currentMonth, basePath))` to `router.push(monthHref(target, currentMonth, basePath, params))`.

Run: `npx vitest run components/Summary/components/MonthSelector`
Expected: PASS (every earlier test too: `?month=2026-08` and the bare address are unchanged).

- [ ] **Step 3: Write the failing column tests**

Create `components/Summary/components/CurrencySection/CurrencySection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SummaryRow } from "../../types";
import { CurrencySection } from "./CurrencySection";

const ARS: SummaryRow = {
  currency: "ARS",
  incomes: { total: "$ 1.400,00", settled: "$ 1.000,00", pending: "$ 400,00" },
  expenses: { total: "$ 500,00", settled: "$ 300,00", pending: "$ 200,00" },
  previous: "$ 5.000,00",
  current: "$ 700,00",
  target: "$ 900,00",
  reimbursements: "$ 40,00",
  paidPercent: 60,
};

describe("CurrencySection", () => {
  it("lays the incomes, the expenses and the remainders out as three columns, in that order", () => {
    render(<CurrencySection row={ARS} />);

    const section = screen.getByRole("region", { name: "Resumen en ARS" });
    const columns = section.querySelectorAll("[data-column]");

    expect(columns).toHaveLength(3);
    expect(
      [...columns].map((column) => column.getAttribute("data-column")),
    ).toEqual(["incomes", "expenses", "remainders"]);
  });

  it("keeps the currency's code as the section's heading for assistive technology", () => {
    render(<CurrencySection row={ARS} />);

    expect(screen.getByRole("heading", { level: 2, name: "ARS" })).toHaveClass(
      "sr-only",
    );
  });

  it("shows under Gastos how much of the total is paid, as a bar and in words", () => {
    render(<CurrencySection row={ARS} />);

    const bar = screen.getByRole("progressbar", {
      name: "Pagado del total en ARS",
    });
    const expenses = screen
      .getByRole("list", { name: "Gastos en ARS" })
      .closest("[data-column]") as HTMLElement;

    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(within(expenses).getByText("60 % pagado")).toBeInTheDocument();
    expect(within(expenses).getByRole("progressbar")).toBe(bar);
  });

  it("has the paid bar only under Gastos", () => {
    render(<CurrencySection row={ARS} />);

    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });
});
```

Run: `npx vitest run components/Summary/components/CurrencySection/CurrencySection.test.tsx`
Expected: FAIL (no `[data-column]`, the heading has no `sr-only`, no progressbar).

- [ ] **Step 4: Write the columns**

Append to `components/Summary/components/CurrencySection/consts.ts`:

```ts
// The paid bar under Gastos: its name for assistive technology and its words beside it.
export const paidLabel = (currency: string): string =>
  `Pagado del total en ${currency}`;

export const paidText = (percent: number): string => `${percent} % pagado`;
```

Replace `components/Summary/components/CurrencySection/styles.ts` with:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-3";

// The tab already names the currency; the heading stays for assistive technology.
export const HEADING_CLASS_NAME = "sr-only";

// Ingresos, Gastos and Remanentes side by side on a wide screen, stacked on a phone.
export const COLUMNS_CLASS_NAME = "grid gap-4 lg:grid-cols-3";

export const COLUMN_CLASS_NAME = "flex min-w-0 flex-col gap-2";

export const PAID_CLASS_NAME = "flex items-center gap-3";

export const PAID_BAR_CLASS_NAME = "min-w-0 flex-1";

export const PAID_TEXT_CLASS_NAME = "shrink-0 text-xs text-muted tabular-nums";
```

Replace `components/Summary/components/CurrencySection/CurrencySection.tsx` with:

```tsx
import { ProgressBar } from "@heroui/react";

import { MetricCard } from "@/components/shared/MetricCard";

import { SUMMARY_ROWS } from "../../consts";
import { CardRow } from "../CardRow";
import { paidLabel, paidText } from "./consts";
import {
  COLUMN_CLASS_NAME,
  COLUMNS_CLASS_NAME,
  HEADING_CLASS_NAME,
  PAID_BAR_CLASS_NAME,
  PAID_CLASS_NAME,
  PAID_TEXT_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { CurrencySectionProps } from "./types";
import { rowLabel, sectionLabel, valueFor } from "./utils";

// Everything about one currency in the month, in three columns: incomes, expenses (with how much of
// them is paid) and the remainders they leave. Currencies are never added together, so each one has a
// section of its own.
export function CurrencySection({ row }: CurrencySectionProps) {
  const { currency } = row;

  return (
    <section className={ROOT_CLASS_NAME} aria-label={sectionLabel(currency)}>
      <h2 className={HEADING_CLASS_NAME}>{currency}</h2>

      <div className={COLUMNS_CLASS_NAME}>
        {SUMMARY_ROWS.map((spec) => (
          <div
            key={spec.id}
            className={COLUMN_CLASS_NAME}
            data-column={spec.id}
          >
            <CardRow
              label={rowLabel(spec.title, currency)}
              title={spec.title}
              Icon={spec.Icon}
              tone={spec.tone}
            >
              {spec.cards.map((card) => (
                <MetricCard
                  key={card.id}
                  label={card.label}
                  value={valueFor(row, spec, card)}
                  description={card.description}
                  emphasis={card.emphasis ?? spec.emphasis}
                  tone={spec.tone === "balance" ? undefined : spec.tone}
                />
              ))}
            </CardRow>
            {spec.id === "expenses" ? (
              <div className={PAID_CLASS_NAME}>
                <ProgressBar
                  aria-label={paidLabel(currency)}
                  size="sm"
                  value={row.paidPercent}
                  className={PAID_BAR_CLASS_NAME}
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                <span className={PAID_TEXT_CLASS_NAME}>
                  {paidText(row.paidPercent)}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
```

Replace `components/Summary/components/LoadingSummary/styles.ts` with:

```ts
// The same three columns as the real section, so nothing jumps when the numbers arrive.
export const ROOT_CLASS_NAME = "grid gap-4 lg:grid-cols-3";
```

(`LoadingSummary.tsx` keeps its markup: each `CardRow` is already one grid cell.)

Run: `npx vitest run components/Summary`
Expected: PASS (the new section tests and every existing `Summary.test.tsx` test: the `h2` "ARS"/"USD" still exist as headings, the regions, lists and cards are unchanged).

- [ ] **Step 5: Write the failing tab helper tests**

Create `components/Summary/components/MonthSection/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { chartsFor, currencyParams, resolveCurrency } from "./utils";

describe("resolveCurrency", () => {
  it("is the chosen currency when it has a tab", () => {
    expect(resolveCurrency("USD", ["ARS", "USD"])).toBe("USD");
  });

  it("falls back to the first tab for a currency without one, or for none chosen", () => {
    expect(resolveCurrency("XYZ", ["ARS", "USD"])).toBe("ARS");
    expect(resolveCurrency(null, ["USD", "USDC"])).toBe("USD");
  });

  it("is ARS when there is no tab at all", () => {
    expect(resolveCurrency("USD", [])).toBe("ARS");
  });
});

describe("currencyParams", () => {
  it("writes any currency but the default one", () => {
    expect(currencyParams("USD")).toEqual({ currency: "USD" });
    expect(currencyParams("USDC")).toEqual({ currency: "USDC" });
  });

  it("writes nothing for ARS or for no choice", () => {
    expect(currencyParams("ARS")).toEqual({});
    expect(currencyParams(null)).toEqual({});
  });
});

describe("chartsFor", () => {
  it("is the currency's own charts", () => {
    const usd = { currency: "USD", monthly: [], categories: [], daily: [] };

    expect(chartsFor([{ ...usd, currency: "ARS" }, usd], "USD")).toBe(usd);
  });

  it("is empty charts for a currency with nothing to draw", () => {
    expect(chartsFor([], "EUR")).toEqual({
      currency: "EUR",
      monthly: [],
      categories: [],
      daily: [],
    });
  });
});
```

Run: `npx vitest run components/Summary/components/MonthSection/utils.test.ts`
Expected: FAIL (`Failed to resolve import "./utils"`).

- [ ] **Step 6: Write the tab helpers**

Create `components/Summary/components/MonthSection/utils.ts`:

```ts
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import { CURRENCY_PARAM } from "../../consts";
import type { CurrencyChartsRow } from "../../types";

// The tab to show: the chosen currency when it has a tab, otherwise the first one (ARS when present).
export const resolveCurrency = (
  selected: string | null,
  currencies: readonly string[],
): string =>
  selected !== null && currencies.includes(selected)
    ? selected
    : (currencies[0] ?? DEFAULT_CURRENCY_CODE);

// What the address carries for a tab: nothing for ARS (the default), `currency=CODE` for any other.
export const currencyParams = (
  currency: string | null,
): Record<string, string> =>
  currency === null || currency === DEFAULT_CURRENCY_CODE
    ? {}
    : { [CURRENCY_PARAM]: currency };

// The charts of one currency, or empty charts when it has nothing to draw.
export const chartsFor = (
  charts: readonly CurrencyChartsRow[],
  currency: string,
): CurrencyChartsRow =>
  charts.find((row) => row.currency === currency) ?? {
    currency,
    monthly: [],
    categories: [],
    daily: [],
  };
```

Run: `npx vitest run components/Summary/components/MonthSection/utils.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing month block tests**

Create `components/Summary/components/MonthSection/MonthSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { BlockResult, CurrencyChartsRow, SummaryRow } from "../../types";
import { MonthSection } from "./MonthSection";
import type { MonthSectionProps } from "./types";

const ARS: SummaryRow = {
  currency: "ARS",
  incomes: { total: "$ 1.400,00", settled: "$ 1.000,00", pending: "$ 400,00" },
  expenses: { total: "$ 500,00", settled: "$ 300,00", pending: "$ 200,00" },
  previous: "$ 5.000,00",
  current: "$ 700,00",
  target: "$ 900,00",
  reimbursements: "$ 40,00",
  paidPercent: 60,
};

const USD: SummaryRow = {
  currency: "USD",
  incomes: { total: "US$ 50,00", settled: "US$ 50,00", pending: "US$ 0,00" },
  expenses: { total: "US$ 0,00", settled: "US$ 0,00", pending: "US$ 0,00" },
  previous: "US$ 0,00",
  current: "US$ 50,00",
  target: "US$ 50,00",
  reimbursements: "US$ 0,00",
  paidPercent: 0,
};

const USDC: SummaryRow = { ...USD, currency: "USDC", current: "1,50 USDC" };

const USD_CHARTS: CurrencyChartsRow = {
  currency: "USD",
  monthly: [
    {
      month: "2026-09",
      monthLabel: "sep 26",
      incomes: 5000,
      expenses: 0,
      incomesLabel: "US$ 50,00",
      expensesLabel: "US$ 0,00",
    },
  ],
  categories: [],
  daily: [],
};

const CHARTS_OK: BlockResult<readonly CurrencyChartsRow[]> = {
  status: "ok",
  value: [USD_CHARTS],
};

const renderMonth = (patch: Partial<MonthSectionProps> = {}) =>
  render(
    <MonthSection
      month="2026-09"
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      currencyParam={null}
      summary={[ARS, USD, USDC]}
      charts={CHARTS_OK}
      aside={<button type="button">Saldo inicial</button>}
      controls={<p>Interruptor</p>}
      {...patch}
    />,
  );

const tab = (name: string) => screen.getByRole("tab", { name });

beforeEach(() => {
  router.push.mockClear();
  window.history.replaceState(null, "", "/dashboard/overview");
});

describe("MonthSection", () => {
  it("is the month block, with its heading, the month selector, the side controls and the controls under them", () => {
    renderMonth();

    const block = screen.getByRole("region", { name: "El mes en detalle" });

    expect(
      within(block).getByRole("navigation", { name: "Mes" }),
    ).toHaveTextContent("Septiembre de 2026");
    expect(
      within(block).getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(
      within(block)
        .getByText("Interruptor")
        .compareDocumentPosition(within(block).getByRole("tablist")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("has one tab per currency, in the order given, ARS selected by default", () => {
    renderMonth();

    const tabs = within(
      screen.getByRole("tablist", { name: "Moneda" }),
    ).getAllByRole("tab");

    expect(tabs.map((each) => each.textContent)).toEqual([
      "ARS",
      "USD",
      "USDC",
    ]);
    expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en USD" }),
    ).not.toBeInTheDocument();
  });

  it("opens the tab the address asks for", () => {
    renderMonth({ currencyParam: "USD" });

    expect(tab("USD")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en USD" }),
    ).toBeInTheDocument();
  });

  it("falls back to the first tab for a currency the user has no tab for", () => {
    renderMonth({ currencyParam: "XYZ" });

    expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
  });

  it("switches currency without leaving the page, and writes it in the address", () => {
    renderMonth();

    fireEvent.click(tab("USDC"));

    expect(
      screen.getByRole("region", { name: "Resumen en USDC" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?currency=USDC");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves ARS out of the address, and keeps the month in it", () => {
    renderMonth({ month: "2026-08", currencyParam: "USD" });

    fireEvent.click(tab("ARS"));

    expect(window.location.search).toBe("?month=2026-08");
  });

  it("keeps the chosen currency when the month changes", () => {
    renderMonth();

    fireEvent.click(tab("USD"));
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-08&currency=USD",
    );
  });

  it("shows the charts of the selected currency only", () => {
    renderMonth({ currencyParam: "USD" });

    expect(
      screen.getByLabelText("sep 26: ingresos US$ 50,00, gastos US$ 0,00"),
    ).toBeInTheDocument();

    fireEvent.click(tab("ARS"));

    expect(
      screen.queryByLabelText("sep 26: ingresos US$ 50,00, gastos US$ 0,00"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Todavía no hay ingresos ni gastos en estos meses."),
    ).toBeInTheDocument();
  });

  it("an error in the charts leaves the month's figures on screen, with a way to try again", () => {
    renderMonth({ currencyParam: "USD", charts: { status: "error" } });

    expect(
      screen.getByRole("region", { name: "Resumen en USD" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?currency=USD",
    );
  });

  it("shows the loading figures while the month's numbers are on their way, and the controls already", async () => {
    let arrive!: (rows: SummaryRow[]) => void;
    const pending = new Promise<SummaryRow[]>((resolve) => {
      arrive = resolve;
    });

    renderMonth({ summary: pending });

    expect(
      screen.getByRole("region", { name: "Cargando resumen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    await act(async () => arrive([ARS]));

    expect(
      await screen.findByRole("tablist", { name: "Moneda" }),
    ).toBeInTheDocument();
  });

  it("shows ARS at zero when the month brings no row at all", () => {
    renderMonth({ summary: [] });

    expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    ).toHaveTextContent(/0,00/);
  });
});
```

Run: `npx vitest run components/Summary/components/MonthSection/MonthSection.test.tsx`
Expected: FAIL (`Failed to resolve import "./MonthSection"`).

- [ ] **Step 8: Write the panels and the month block**

Create `components/Summary/components/MonthSection/components/CurrencyPanels/types.ts`:

```ts
import type { Source } from "@/components/shared/Await";

import type {
  BlockResult,
  CurrencyChartsRow,
  SummaryRow,
} from "../../../../types";

export interface CurrencyPanelsProps {
  // One per tab, in the tabs' order.
  rows: readonly SummaryRow[];
  charts: Source<BlockResult<readonly CurrencyChartsRow[]>>;
  // The chosen currency (from the address or a press), or null for the default tab.
  selected: string | null;
  onSelect: (currency: string) => void;
  // Where "Reintentar" goes when the charts could not be read.
  retryHref: string;
}
```

Create `.../CurrencyPanels/consts.ts`:

```ts
export const TABS_LABEL = "Moneda";
```

Create `.../CurrencyPanels/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-4";

export const PANEL_CLASS_NAME = "flex flex-col gap-6 pt-2";

// Roughly the charts' height, so the page does not jump when they arrive.
export const CHARTS_SKELETON_CLASS_NAME = "h-64 w-full rounded-2xl";
```

Create `.../CurrencyPanels/CurrencyPanels.tsx`:

```tsx
import { Skeleton, Tabs } from "@heroui/react";

import { Await } from "@/components/shared/Await";

import { BlockError } from "../../../BlockError";
import { Charts } from "../../../Charts";
import { CurrencySection } from "../../../CurrencySection";
import { chartsFor, resolveCurrency } from "../../utils";
import { TABS_LABEL } from "./consts";
import {
  CHARTS_SKELETON_CLASS_NAME,
  PANEL_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { CurrencyPanelsProps } from "./types";

// One tab per currency; the selected one shows its three columns and its charts. Every currency's
// numbers are already here, so a tab change never waits.
export function CurrencyPanels({
  rows,
  charts,
  selected,
  onSelect,
  retryHref,
}: CurrencyPanelsProps) {
  const current = resolveCurrency(
    selected,
    rows.map(({ currency }) => currency),
  );

  return (
    <Tabs
      className={ROOT_CLASS_NAME}
      selectedKey={current}
      onSelectionChange={(key) => onSelect(String(key))}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label={TABS_LABEL}>
          {rows.map(({ currency }) => (
            <Tabs.Tab key={currency} id={currency}>
              {currency}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {rows.map((row) => (
        <Tabs.Panel
          key={row.currency}
          id={row.currency}
          className={PANEL_CLASS_NAME}
        >
          <CurrencySection row={row} />
          <Await
            source={charts}
            fallback={<Skeleton className={CHARTS_SKELETON_CLASS_NAME} />}
          >
            {(result) =>
              result.status === "ok" ? (
                <Charts row={chartsFor(result.value, row.currency)} />
              ) : (
                <BlockError retryHref={retryHref} />
              )
            }
          </Await>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
```

Create `.../CurrencyPanels/index.ts`:

```ts
export { CurrencyPanels } from "./CurrencyPanels";
```

Create `components/Summary/components/MonthSection/types.ts`:

```ts
import type { ReactNode } from "react";

import type { Source } from "@/components/shared/Await";

import type { BlockResult, CurrencyChartsRow, SummaryRow } from "../../types";

export interface MonthSectionProps {
  // "YYYY-MM": the month shown and the month in course.
  month: string;
  currentMonth: string;
  // "Septiembre de 2026".
  monthLabel: string;
  // The currency the address asks for (already in capitals), or null.
  currencyParam: string | null;
  // One row per currency tab, or a promise of them while they load.
  summary: Source<readonly SummaryRow[]>;
  charts: Source<BlockResult<readonly CurrencyChartsRow[]>>;
  // Beside the month selector ("Saldo inicial").
  aside: ReactNode;
  // Under the heading, above the tabs (the expected incomes switch).
  controls: ReactNode;
}
```

Create `components/Summary/components/MonthSection/consts.ts`:

```ts
export const MONTH_SECTION_TITLE = "El mes en detalle";

export const MONTH_HEADING_ID = "month-heading";
```

Create `components/Summary/components/MonthSection/styles.ts`:

```ts
export const ROOT_CLASS_NAME = "flex flex-col gap-4";

export const HEADER_CLASS_NAME =
  "flex flex-wrap items-center justify-between gap-3";

export const HEADING_CLASS_NAME = "text-lg font-semibold";

export const TOOLBAR_CLASS_NAME = "flex flex-wrap items-center gap-2";
```

Create `components/Summary/components/MonthSection/MonthSection.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Await } from "@/components/shared/Await";

import { EMPTY_ROWS, SUMMARY_PATH } from "../../consts";
import { LoadingSummary } from "../LoadingSummary";
import { MonthSelector } from "../MonthSelector";
import { monthHref } from "../MonthSelector/utils";
import { CurrencyPanels } from "./components/CurrencyPanels";
import { MONTH_HEADING_ID, MONTH_SECTION_TITLE } from "./consts";
import {
  HEADER_CLASS_NAME,
  HEADING_CLASS_NAME,
  ROOT_CLASS_NAME,
  TOOLBAR_CLASS_NAME,
} from "./styles";
import type { MonthSectionProps } from "./types";
import { currencyParams } from "./utils";

// The month in detail: the month selector and its controls, then one tab per currency with its
// figures and charts. The chosen currency is local state mirrored into the address (replaceState: the
// numbers of every currency are already here, so nothing is fetched again), and the month selector
// carries it to the next month.
export function MonthSection({
  month,
  currentMonth,
  monthLabel,
  currencyParam,
  summary,
  charts,
  aside,
  controls,
}: MonthSectionProps) {
  const [selected, setSelected] = useState<string | null>(currencyParam);
  const params = currencyParams(selected);

  const select = (currency: string) => {
    setSelected(currency);
    window.history.replaceState(
      null,
      "",
      monthHref(month, currentMonth, SUMMARY_PATH, currencyParams(currency)),
    );
  };

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby={MONTH_HEADING_ID}>
      <div className={HEADER_CLASS_NAME}>
        <h2 id={MONTH_HEADING_ID} className={HEADING_CLASS_NAME}>
          {MONTH_SECTION_TITLE}
        </h2>
        <div className={TOOLBAR_CLASS_NAME}>
          {aside}
          <MonthSelector
            month={month}
            label={monthLabel}
            currentMonth={currentMonth}
            params={params}
          />
        </div>
      </div>

      {controls}

      {/* Keyed by the month: another month is another set of numbers, so it gets a fresh boundary
          that shows the loading figures at once, instead of keeping the previous month's numbers on
          screen under the new month's name until the new ones arrive. */}
      <Await key={month} source={summary} fallback={<LoadingSummary />}>
        {(rows) => (
          <CurrencyPanels
            rows={rows.length > 0 ? rows : EMPTY_ROWS}
            charts={charts}
            selected={selected}
            onSelect={select}
            retryHref={monthHref(month, currentMonth, SUMMARY_PATH, params)}
          />
        )}
      </Await>
    </section>
  );
}
```

Create `components/Summary/components/MonthSection/index.ts`:

```ts
export { MonthSection } from "./MonthSection";
```

Run: `npx vitest run components/Summary/components/MonthSection`
Expected: PASS. If a tab does not get selected by `fireEvent.click` (React Aria turns a bare `click` into a virtual press on its tabs; if this HeroUI version needs pointer events), replace the `fireEvent.click(tab(...))` calls with `fireEvent.pointerDown(tab(...)); fireEvent.pointerUp(tab(...)); fireEvent.click(tab(...));` in this file and keep every assertion.

- [ ] **Step 9: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts`, `npx prettier --check --end-of-line auto components/Summary/components/MonthSelector components/Summary/components/CurrencySection components/Summary/components/LoadingSummary components/Summary/components/MonthSection`.
Expected: all green. The running page (still the old `Summary`) shows each currency's section as three columns with the paid bar; `MonthSection` is not rendered yet.

- [ ] **Step 10: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 7: The page composition: "Por cuenta" on top, attention, the month block

Read first: `.heroui-docs/react/components/(feedback)/skeleton.mdx`. Copy: the current `components/Summary/Summary.tsx` (the `useOverlayState` + `openingSession` pattern of the opening balance drawer stays exactly as it is).

**Files:**

- Modify: `components/Summary/Summary.tsx`, `components/Summary/types.ts` (`SummaryProps`), `components/Summary/styles.ts`
- Modify: `components/Summary/Summary.test.tsx`
- Modify: `app/dashboard/overview/page.tsx`
- Modify: `components/Summary/components/AccountsSection/components/CurrencyAccountsCard/components/BankBalances/BankBalances.tsx`, `components/Summary/components/AccountsSection/AccountsSection.test.tsx` (the full name as a title)

**Interfaces:**

- Consumes: Tasks 3 to 6 (`AttentionSection`, `BlockError`, `MonthSection`, `monthHref`, `BlockResult`, `AttentionGroupRow`, `CurrencyChartsRow`, `CURRENCY_PARAM`, `parseCurrencyParam`, the loader's `attention` and `charts`).
- Produces: `SummaryProps` gains `currencyParam: string | null`, `attention: Source<BlockResult<readonly AttentionGroupRow[]>>`, `charts: Source<BlockResult<readonly CurrencyChartsRow[]>>`; the page renders the new order. Removed as dead: `ASIDE_CLASS_NAME` and `SECTIONS_CLASS_NAME` (`components/Summary/styles.ts`), no longer used once the header has no aside and the sections live in the tabs.

Changes to `components/Summary/Summary.test.tsx` (every test of unchanged behaviour stays; the ones below change because the layout changes, with the same strength):

- `renderSummary` takes the new props (`attention`, `charts`, `currencyParam`) with harmless defaults; fixtures `ARS`/`USD` already carry `paidPercent` (Task 3).
- "has the month selector in its header, with the month it is about" → "has the month selector in the month block, with the month it is about" (same three assertions, scoped to the region "El mes en detalle").
- "offers a Saldo inicial button in the header, beside the month selector" → "offers a Saldo inicial button in the month block, beside the month selector, and none in the page header".
- "sits between the header and the currency sections" (switch) → "sits in the month block, under its heading and before the currency tabs".
- "gives each currency a section with its code as heading" → "gives each currency a tab, and shows the selected one's section with its code as heading".
- "keeps the sections in the order they come" → "keeps the tabs in the order they come".
- "does not mix the amounts of different currencies" → same assertions, reaching USD through its tab.
- "shows what is still expected back as one more card of the incomes row, with what it means" → same assertions, reaching USD through its tab.
- "shows the 'Por cuenta' section under the currency sections, once its numbers arrive" → "shows the 'Por cuenta' section at the top, before the month block, once its numbers arrive".
- Unchanged (kept verbatim): "names the page and the month it is about", "has no Actions button…", "offers the way back to the month in course…", "shows the selector while the numbers are loading…", "does not show the editor until the button is pressed", "opens the editor with the saved opening balance", "shows the button while the numbers and the saved balance are still loading", "opens the editor as soon as the saved balance arrives…", "says what turning it off does", "starts on when…", "starts off when…", "shows the switch while the numbers are still loading…", "waits for the saved value without showing a wrong one", every test of "Summary rows say what they are" except the reimbursements one above, "keeps the shape of the page while the accounts load", "still shows the cards, at zero in the default currency", and the six tests of "Summary while the numbers are loading".
- New: attention shown / hidden, attention error, charts error, the address's currency, the page order.

- [ ] **Step 1: Write the failing page tests**

In `components/Summary/Summary.test.tsx`:

- change the type import to `import type { AttentionGroupRow, CurrencyAccountsRow, SummaryRow } from "./types";`;
- after `ACCOUNTS_ROW` add:

```tsx
const ATTENTION: AttentionGroupRow[] = [
  {
    kind: "negativeAccount",
    title: "Cuentas en negativo",
    linkLabel: "Ver Bancos",
    href: "/dashboard/banks",
    hiddenCount: 0,
    items: [
      {
        id: "a1",
        title: "Galicia · Caja de ahorro",
        amountLabel: "-$ 300,00",
        limitLabel: null,
        dateLabel: null,
        severity: "danger",
      },
    ],
  },
];
```

- replace `renderSummary` with:

```tsx
type SummaryTestProps = Parameters<typeof Summary>[0];

const renderSummary = (
  summary: SummaryTestProps["summary"],
  month = "2026-09",
  openingBalance: SummaryTestProps["openingBalance"] = OPENING,
  includeExpectedIncomes: SummaryTestProps["includeExpectedIncomes"] = true,
  accountBalances: SummaryTestProps["accountBalances"] = [],
  extra: Partial<
    Pick<SummaryTestProps, "attention" | "charts" | "currencyParam">
  > = {},
) =>
  render(
    <Summary
      month={month}
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      currencyParam={extra.currencyParam ?? null}
      summary={summary}
      openingBalance={openingBalance}
      includeExpectedIncomes={includeExpectedIncomes}
      accountBalances={accountBalances}
      attention={extra.attention ?? { status: "ok", value: [] }}
      charts={extra.charts ?? { status: "ok", value: [] }}
    />,
  );

const monthBlock = () =>
  within(screen.getByRole("region", { name: "El mes en detalle" }));

const showTab = (currency: string) =>
  fireEvent.click(screen.getByRole("tab", { name: currency }));
```

- replace "has the month selector in its header, with the month it is about" with:

```tsx
it("has the month selector in the month block, with the month it is about", () => {
  renderSummary([ARS]);

  const selector = within(
    monthBlock().getByRole("navigation", { name: "Mes" }),
  );

  expect(selector.getByText("Septiembre de 2026")).toBeInTheDocument();
  expect(
    selector.getByRole("button", { name: "Mes anterior" }),
  ).toBeInTheDocument();
  expect(
    selector.getByRole("button", { name: "Mes siguiente" }),
  ).toBeInTheDocument();
});
```

- replace "offers a Saldo inicial button in the header, beside the month selector" with:

```tsx
it("offers a Saldo inicial button in the month block, beside the month selector, and none in the page header", () => {
  renderSummary([ARS]);

  expect(
    monthBlock().getByRole("button", { name: "Saldo inicial" }),
  ).toBeInTheDocument();
  expect(
    monthBlock().getByRole("navigation", { name: "Mes" }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("banner")).queryByRole("button", {
      name: "Saldo inicial",
    }),
  ).not.toBeInTheDocument();
});
```

- replace "sits between the header and the currency sections" with:

```tsx
it("sits in the month block, under its heading and before the currency tabs", () => {
  renderSummary([ARS]);

  const header = screen.getByRole("banner");
  const tabs = screen.getByRole("tablist", { name: "Moneda" });

  expect(within(header).queryByRole("switch")).not.toBeInTheDocument();
  expect(monthBlock().getByRole("switch")).toBe(toggle());
  expect(
    monthBlock()
      .getByRole("heading", { level: 2, name: "El mes en detalle" })
      .compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    toggle().compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
```

- replace the whole `describe("Summary sections", …)` with:

```tsx
describe("Summary sections", () => {
  it("gives each currency a tab, and shows the selected one's section with its code as heading", () => {
    renderSummary([ARS, USD]);

    expect(screen.getByRole("tab", { name: "ARS" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "USD" }),
    ).not.toBeInTheDocument();

    showTab("USD");

    expect(
      screen.getByRole("heading", { level: 2, name: "USD" }),
    ).toBeInTheDocument();
  });

  it("keeps the tabs in the order they come", () => {
    renderSummary([ARS, USD]);

    expect(
      within(screen.getByRole("tablist", { name: "Moneda" }))
        .getAllByRole("tab")
        .map((each) => each.textContent),
    ).toEqual(["ARS", "USD"]);
  });

  it("does not mix the amounts of different currencies", () => {
    renderSummary([ARS, USD]);

    expect(card(row("Remanentes en ARS"), "Actual")).not.toHaveTextContent(
      "US$",
    );

    showTab("USD");

    expect(card(row("Remanentes en USD"), "Actual")).toHaveTextContent(
      "US$ 50,00",
    );
  });

  it("opens the tab the address asks for", () => {
    renderSummary([ARS, USD], "2026-09", OPENING, true, [], {
      currencyParam: "USD",
    });

    expect(screen.getByRole("tab", { name: "USD" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(card(row("Remanentes en USD"), "Actual")).toHaveTextContent(
      "US$ 50,00",
    );
  });
});
```

- replace "shows what is still expected back as one more card of the incomes row, with what it means" with:

```tsx
it("shows what is still expected back as one more card of the incomes row, with what it means", () => {
  renderSummary([ARS, USD]);

  const reimbursements = card(row("Ingresos en ARS"), "Reintegros pendientes");

  expect(reimbursements).toHaveTextContent("$ 40,00");
  expect(reimbursements).toHaveTextContent(
    "Lo que esperás que te devuelvan y todavía no registraste como ingreso.",
  );

  showTab("USD");

  expect(
    card(row("Ingresos en USD"), "Reintegros pendientes"),
  ).toHaveTextContent("US$ 0,00");
});
```

- replace "shows the 'Por cuenta' section under the currency sections, once its numbers arrive" with:

```tsx
it("shows the 'Por cuenta' section at the top, before the month block, once its numbers arrive", () => {
  renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW]);

  const accounts = screen.getByRole("heading", { name: "Por cuenta" });

  expect(
    screen.getByRole("region", { name: "Por cuenta en ARS" }),
  ).toBeInTheDocument();
  expect(
    accounts.compareDocumentPosition(
      screen.getByRole("region", { name: "El mes en detalle" }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
```

- append:

```tsx
describe("Summary attention block", () => {
  it("shows what needs attention between 'Por cuenta' and the month block", () => {
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "ok", value: ATTENTION },
    });

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Requiere atención",
    });

    expect(
      screen
        .getByRole("heading", { name: "Por cuenta" })
        .compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      heading.compareDocumentPosition(
        screen.getByRole("region", { name: "El mes en detalle" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver Bancos" })).toHaveAttribute(
      "href",
      "/dashboard/banks",
    );
  });

  it("is not there when nothing needs attention", () => {
    renderSummary([ARS]);

    expect(
      screen.queryByRole("heading", { name: "Requiere atención" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "El mes en detalle" }),
    ).toBeInTheDocument();
  });
});

describe("Summary when a block cannot be loaded", () => {
  it("an error in the attention block or the charts leaves the rest of the page on screen", () => {
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "error" },
      charts: { status: "error" },
    });

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "No pudimos cargar esto.",
    );
    expect(screen.getAllByRole("link", { name: "Reintentar" })).toHaveLength(2);
    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
    expect(card(row("Remanentes en ARS"), "Actual")).toHaveTextContent(
      "$ 700,00",
    );
  });

  it("shows no error while every block loads", () => {
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "ok", value: ATTENTION },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Requiere atención" }),
    ).toBeInTheDocument();
  });
});
```

In `components/Summary/components/AccountsSection/AccountsSection.test.tsx`, append inside `describe("AccountsSection", …)`:

```tsx
it("keeps the full name of an account as a title, so a long one that is cut can still be read", () => {
  render(<AccountsSection rows={[ARS]} />);

  expect(screen.getByText("Caja de ahorro")).toHaveAttribute(
    "title",
    "Caja de ahorro",
  );
  expect(screen.getByText(/Vieja/)).toHaveAttribute(
    "title",
    "Vieja (archivada)",
  );
});
```

Run: `npx vitest run components/Summary/Summary.test.tsx components/Summary/components/AccountsSection`
Expected: FAIL (`tsc`-level prop errors aside, at runtime: no region "El mes en detalle", no tablist, no attention heading; the account name has no title).

- [ ] **Step 2: Write the composition**

In `components/Summary/types.ts`, replace `interface SummaryProps` with:

```ts
export interface SummaryProps {
  // The month the numbers belong to, "YYYY-MM", and the month in course, which is where the
  // selector's "Mes actual" goes.
  month: string;
  currentMonth: string;
  // The month the numbers belong to, written out ("Septiembre de 2026").
  monthLabel: string;
  // The currency tab the address asks for (in capitals), or null for the default one.
  currencyParam: string | null;
  // One row per currency tab, or a promise of them while they load.
  summary: Source<readonly SummaryRow[]>;
  // What the opening balance editor starts from, or a promise of it while it loads.
  openingBalance: Source<OpeningBalanceData>;
  // Whether the target remainder counts the incomes still to collect (the saved setting), or a
  // promise of it while it loads.
  includeExpectedIncomes: Source<boolean>;
  // What each account holds today, per currency and bank, or a promise of it while it loads.
  accountBalances: Source<readonly CurrencyAccountsRow[]>;
  // What needs attention today, or an error result when it could not be read.
  attention: Source<BlockResult<readonly AttentionGroupRow[]>>;
  // The charts of every currency of the month, or an error result when they could not be read.
  charts: Source<BlockResult<readonly CurrencyChartsRow[]>>;
}
```

Replace `components/Summary/styles.ts` with:

```ts
// The page is a column of sections that scrolls with the page area around it.
export const ROOT_CLASS_NAME = "flex flex-col gap-6 px-4 pt-3 pb-6";

// Where the expected incomes switch will be, while its saved value is on its way: the same room, so
// the page does not jump when it arrives.
export const SWITCH_SKELETON_CLASS_NAME = "h-10 w-72 max-w-full rounded-xl";

// Where the "Por cuenta" section will be, while its balances are on their way: roughly its height, so
// the page does not jump when it arrives.
export const ACCOUNTS_SKELETON_CLASS_NAME = "h-40 w-full max-w-xl rounded-2xl";

// Where the attention block may be, while it is read: short, since it is often not there at all.
export const ATTENTION_SKELETON_CLASS_NAME =
  "h-16 w-full max-w-3xl rounded-2xl";
```

Replace `components/Summary/Summary.tsx` with:

```tsx
"use client";

import { Button, Skeleton, useOverlayState } from "@heroui/react";
import { useState } from "react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { Await } from "@/components/shared/Await";

import { AccountsSection } from "./components/AccountsSection";
import { AttentionSection } from "./components/AttentionSection";
import { BlockError } from "./components/BlockError";
import { ExpectedIncomesSwitch } from "./components/ExpectedIncomesSwitch";
import { MonthSection } from "./components/MonthSection";
import { monthHref } from "./components/MonthSelector/utils";
import { OpeningBalanceDrawer } from "./components/OpeningBalanceDrawer";
import { OPENING_BALANCE_LABEL, PAGE_DESCRIPTION, PAGE_TITLE } from "./consts";
import {
  ACCOUNTS_SKELETON_CLASS_NAME,
  ATTENTION_SKELETON_CLASS_NAME,
  ROOT_CLASS_NAME,
  SWITCH_SKELETON_CLASS_NAME,
} from "./styles";
import type { SummaryProps } from "./types";

// The overview, top to bottom: what each account holds today, what needs attention, and the month in
// detail, one currency at a time. The header renders at once; each block waits for its own numbers,
// and a block that cannot be read shows a short error in its place.
export function Summary({
  month,
  currentMonth,
  monthLabel,
  currencyParam,
  summary,
  openingBalance,
  includeExpectedIncomes,
  accountBalances,
  attention,
  charts,
}: SummaryProps) {
  const openingState = useOverlayState();
  // Remounts the editor on every opening, so each one starts from what is saved.
  const [openingSession, setOpeningSession] = useState(0);

  const openOpeningBalance = () => {
    setOpeningSession((current) => current + 1);
    openingState.open();
  };

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

      {/* Today's balance of each account: it does not depend on the month shown, so it has its own
          promise and its own boundary, and stays put when the month changes. */}
      <Await
        source={accountBalances}
        fallback={<Skeleton className={ACCOUNTS_SKELETON_CLASS_NAME} />}
      >
        {(rows) => <AccountsSection rows={rows} />}
      </Await>

      {/* What needs attention today: not rendered when nothing does. */}
      <Await
        source={attention}
        fallback={<Skeleton className={ATTENTION_SKELETON_CLASS_NAME} />}
      >
        {(result) =>
          result.status === "ok" ? (
            <AttentionSection groups={result.value} />
          ) : (
            <BlockError retryHref={monthHref(month, currentMonth)} />
          )
        }
      </Await>

      <MonthSection
        month={month}
        currentMonth={currentMonth}
        monthLabel={monthLabel}
        currencyParam={currencyParam}
        summary={summary}
        charts={charts}
        aside={
          <Button variant="secondary" onPress={openOpeningBalance}>
            {OPENING_BALANCE_LABEL}
          </Button>
        }
        controls={
          // Tied to the Remanentes column: it decides what the Objetivo card counts, in every
          // currency. It has its own promise, so it shows as soon as the setting is read.
          <Await
            source={includeExpectedIncomes}
            fallback={<Skeleton className={SWITCH_SKELETON_CLASS_NAME} />}
          >
            {(isSelected) => <ExpectedIncomesSwitch isSelected={isSelected} />}
          </Await>
        }
      />

      {/* The editor mounts once its data is here; a press before that opens it on arrival. */}
      <Await source={openingBalance} fallback={null}>
        {(data) => (
          <OpeningBalanceDrawer
            isOpen={openingState.isOpen}
            onOpenChange={openingState.setOpen}
            onClose={openingState.close}
            currentMonth={currentMonth}
            data={data}
            sessionKey={openingSession}
          />
        )}
      </Await>
    </main>
  );
}
```

Note: the `//` comment inside `controls={ … }` is a plain JavaScript comment inside the expression container, which is valid; prettier may move it, keep its text.

In `components/Summary/types.ts`, `BlockResult`, `AttentionGroupRow` and `CurrencyChartsRow` are already in the file (Task 3).

In `BankBalances.tsx`, give the name span its full text as a title:

```tsx
            <span
              className={NAME_CLASS_NAME}
              title={
                account.isArchived
                  ? `${account.name}${ARCHIVED_SUFFIX}`
                  : account.name
              }
            >
```

(keep its children as they are).

Replace `app/dashboard/overview/page.tsx` with:

```tsx
import { Summary } from "@/components/Summary";
import { CURRENCY_PARAM, MONTH_PARAM } from "@/components/Summary/consts";
import { todayIso } from "@/core/incomes/dates";
import { formatMonth, monthOf, parseMonthParam } from "@/core/summary/month";
import { parseCurrencyParam } from "@/core/summary/tabs";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadSummaryView } from "./loadSummaryView";

export default async function OverviewPage({
  searchParams,
}: PageProps<"/dashboard/overview">) {
  const userId = await requireUserId();
  const params = await searchParams;

  // "Today" is the Argentine calendar date: it decides the month in course (what the summary shows
  // when the address asks for no month, and what a bad month falls back to) and what needs attention.
  const today = todayIso();
  const currentMonth = monthOf(today);
  const month = parseMonthParam(params[MONTH_PARAM], currentMonth);

  // Not awaited on purpose: the database work starts here and streams in behind the page, so the
  // header is on screen at once and each block waits only for its own numbers.
  const view = loadSummaryView(userId, month, today);

  return (
    <Summary
      month={month}
      currentMonth={currentMonth}
      monthLabel={formatMonth(month)}
      currencyParam={parseCurrencyParam(params[CURRENCY_PARAM])}
      {...view}
    />
  );
}
```

Run: `npx vitest run components/Summary app/dashboard/overview`
Expected: PASS. If a tab press does not select it, apply the same pointer-event fallback as Task 6, Step 8, in `showTab`.

- [ ] **Step 3: Remove what nothing uses any more**

Run: `rg -n "ASIDE_CLASS_NAME|SECTIONS_CLASS_NAME" components app`
Expected: no match (Step 2 already removed both from `components/Summary/styles.ts` and from `Summary.tsx`). Run `rg -n "EMPTY_ROWS" components app`: only `components/Summary/consts.ts` and `components/Summary/components/MonthSection/MonthSection.tsx` (still used: the ARS-at-zero fallback).

- [ ] **Step 4: Verify the task boundary**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts lib/auth/routeProtection.test.ts`, `npx prettier --check --end-of-line auto components/Summary/Summary.tsx components/Summary/Summary.test.tsx components/Summary/types.ts components/Summary/styles.ts components/Summary/components/AccountsSection app/dashboard/overview/page.tsx`.
Expected: all green. The running page now shows "Por cuenta" first, then "Requiere atención" when it applies, then the month block with the tabs and the charts.

- [ ] **Step 5: Do NOT commit (the user commits only when asked); the controller snapshots.**

---

### Task 8: Whole-stage verification, browser pass and handoff

**Files:** none are created for the product. The controller (not an implementer) runs this task; if a check fails, the failing task's implementer fixes it.

**Interfaces:**

- Consumes: everything above; the figures recorded before Task 1 (Execution notes).
- Produces: a verified stage and the numbers to report.

- [ ] **Step 1: Static and unit checks**

Run, in this order, and write the results down:

1. `npx vitest run` — all green; record files and tests, compare with the baseline of Task 1 (the difference is exactly the new test files and cases; no test file was deleted).
2. `npx tsc --noEmit` — clean.
3. `npm run lint` — clean.
4. `npx vitest run components/componentStructure.test.ts components/shared/PendingButton/pendingButtonUsage.test.ts lib/auth/routeProtection.test.ts` — green.
5. `npx prettier --check --end-of-line auto core/summary components/Summary app/dashboard/overview` — clean.
6. `rg -n "recharts|chart\.js|\"d3|visx|nivo" package.json` — no match (no chart dependency was added). Glob `prisma/migrations/*`: the newest folder is still `20261008120000_bank_kinds` (no new migration). `rg -n "style: \"currency\"" components/Summary core/summary` — no match (every amount goes through `formatMoney`).

- [ ] **Step 2: Browser verification (Playwright MCP; reuse the signed-in session — never sign in for the user; do not close the browser; check port 3000 first and never restart the server; read-only: nothing is created, edited or deleted)**

At desktop width (about 1440px) and then at 390px wide, check each item and note pass or fail:

1. `/dashboard/overview` renders top to bottom: the "Resumen" header (no "Saldo inicial" in it), "Por cuenta", "Requiere atención" (only if something applies), and "El mes en detalle" with "Saldo inicial", the month selector, "Sumar ingresos por cobrar" (same copy as before), the currency tabs, the three columns and the three charts.
2. "Por cuenta": every line and total equals what was recorded before Task 1; negatives in red; a long account name shows its full text on hover.
3. For every currency tab of the current month and of the previous month: Ingresos (Total, Cobrado, Por cobrar, Reintegros pendientes), Gastos (Total, Pagado, Por pagar) and Remanentes (Saldo previo, Actual, Objetivo) equal the figures recorded before Task 1. A currency held only in an account (if any) shows a tab at zero. The paid bar's "N % pagado" matches Pagado / Total.
4. Tabs: pressing USD (or another tab) changes the address to `?currency=USD` without a page reload (the network panel shows no new document request) and shows only that currency's figures and charts; reloading that address opens the same tab; `?currency=xyz` opens ARS; with a tab chosen, "Mes anterior" keeps `currency` in the address.
5. Charts: the last bar of "Ingresos y gastos de los últimos 6 meses" equals Ingresos Total and Gastos Total of the month (tooltip and "Ver como tabla"); the category bars add up to Gastos Total (table view); for the previous month the last point of "Saldo día a día" equals "Actual"; for the current month the line stops at today; a month in the future shows "El mes todavía no empezó: no hay saldos para mostrar."; hover and keyboard (Tab to a month, arrow keys on the daily chart) show the tooltips; no blue anywhere in the active theme (do not change the user's saved theme to check others).
6. "Requiere atención": each line's amount and date match the target page; each "Ver" link lands on the target page with the filter of D2 applied (expenses: "Listado" status and the date range; incomes the same; Bancos and Tarjetas plain), and going back returns to the overview.
7. At 390px: no horizontal page scroll; the three columns and the three charts stack; the tabs scroll sideways when they do not fit; the month block's heading wraps without overlapping.
8. The browser console shows no errors during the pass.

Clean the `.playwright-mcp` scratch files by hand when done; leave the browser open.

- [ ] **Step 3: Handoff to the user**

Report: the final numbers (files, tests), that no migration and no Prisma command was run, the result of the figure-by-figure comparison with the page before the stage, the decisions in "Decisions taken" that the browser pass exercised (D1, D2, D5, D7, D9, D10), and the "Deferred" items below. Do NOT commit (the user commits only when asked); the controller snapshots.

---

## Deferred (not in this stage)

- Everything in the spec's "Out of scope": the sidebar reorganisation and the not-yet-implemented sections (Proyecto, Facturación, Cobros, Calendario, Facturas), forecasts or recommendations beyond the attention items, comparing months, budgets per category, exporting, any change to how balances or totals are calculated, and charts mixing currencies.
- Per-line "Ver" links (opening one expense or one account) and a currency filter on the group links: the target pages filter by status and dates only (D2); reimbursements and accounts have no filter to land on.
- Dismissing or snoozing an attention item; recurring expenses not yet generated by the monthly wizard are not attention items (they are not expenses until the wizard runs).
- A cap used at exactly 80% is not listed (the existing "more than 80%" rule, D1); changing `tierOf` would also change the Cards page.
- A daily balance that includes planned money (a forecast line) and a 6-month chart split into paid and still to pay.
- A chart tooltip that follows the pointer (it sits in the chart's corner) and a printable or high-contrast texture fill for the bars.
- "Por cuenta" beyond moving it and the full-name title (D13): no new compact layout.
- The Help page says nothing about the attention block, the tabs or the charts.
