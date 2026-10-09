# Banks, accounts and transfers — design

Approved in chat on 2026-10-04. Delivered in three stages (see below); one implementation plan per stage.

## Intent

The user holds several virtual wallets and bank accounts (a transport card with benefits, an FCI account that yields daily, cash, ...). They need to know exactly how much money sits in each one, and to move money between their own accounts without that counting as an expense or an income.

Success: every income and expense belongs to an account; the summary shows the balance of each account; a transfer between own accounts changes only that distribution, never a total.

## Decisions

- **Bank → accounts.** A bank has many accounts; an account belongs to exactly one bank and holds exactly one currency.
- **Cash is an account.** The `PaymentMedium` enum (`DIGITAL` / `CASH`) is removed. Cash lives in a default bank named "Efectivo".
- **Transfers are their own model**, not an income/expense category, so no total can include them by mistake.
- **Same-currency only.** Currency exchange stays in Conversions (an income with an origin amount), never in a transfer.
- **Archive, never delete,** a bank or an account that is given up; history keeps pointing at it.
- **Debit and prepaid cards are not modelled.** They debit at purchase time, so the expense is recorded directly on the account. `Card` stays credit-only (closing day, due day, limit); a credit-card expense picks the account that pays the statement.
- **Summary cards "Billetera" and "Disponible" are removed** (no data to migrate; "Disponible" would equal "Actual").

## Data model

- `Bank`: `id`, `userId`, `name` (unique per user), `archivedAt?`.
- `Account`: `id`, `userId`, `bankId` (restrict), `name` (unique per bank), `currency` (immutable once the account has movements), `archivedAt?`.
- `Income`, `Expense`, `RecurringIncome`, `RecurringExpense`, `InstallmentPlan`: drop `medium`, add required `accountId` (restrict). Generated entries (recurring, installments) copy the template's/plan's account. The movement currency must equal the account currency (service check).
- `OpeningBalance`: unique `(userId, accountId)` instead of `(userId, currency, medium)`; every row of a user still shares one `month`.
- `Transfer`: `id`, `userId`, `fromAccountId`, `toAccountId` (restrict), `amount` (BigInt minor units, CHECK > 0), `date` (`@db.Date`), `notes?`, CHECK `fromAccountId <> toAccountId`. Its currency is the accounts' currency (not stored).
- Default data: the first time anything needs accounts, an idempotent `ensureDefaultCash(userId)` creates the bank "Efectivo" with an account "Efectivo" in ARS (guarded by the unique constraints; safe under races).

### Account balance

`balance(account, date) = opening (if the opening month has started) + settled incomes − settled expenses − transfers out + transfers in`, counting entries up to `date`. `PLANNED` and `COVERED` entries never move money. A currency's total is the sum of its accounts, so transfers never change it.

## Stages

1. **Banks and accounts** — models, services, `/dashboard/banks` page and board. Additive; nothing existing changes. Entries do not carry an account yet, so in this stage the tiles show name and currency only; balances, and every rule that depends on a balance or on movements (archive only at zero balance, currency lock, red negative balance), arrive with stage 2.
2. **Account instead of medium** — the heavy stage: ~50 production files and ~66 tests that touch `medium` (schema, `mediumField`, expense/income/recurring/installment services and forms, `MediumField`, `CashMarker`, balances, summary, opening-balance drawer).
3. **Transfers** — model, service, `/dashboard/transfers` page, and the "Por cuenta" card in the summary.

## Banks page (`/dashboard/banks`)

- Sidebar: "Bancos" is a top-level item without children, and so is "Transferencias" (after "Tarjetas"). Route slugs stay English.
- Header with the shared Actions menu: "Crear banco", "Crear cuenta" (drawers like the rest of the app).
- A search field that matches bank and account names; a bank row stays visible when the bank or any of its accounts matches. A toggle shows archived items.
- The board is rows, not columns (a swimlane, not a Gantt): the first column of each row is the bank; the rest of the row holds one tile per account (name, currency, balance), plus a "+ cuenta" tile. Clicking a tile or the bank opens its edit drawer. It is custom, not `DataTable`; it must scroll horizontally on narrow screens.
- Rules (the balance- and movement-dependent ones are enforced from stage 2; in stage 1 an account can always be archived and its currency edited): an account is archived only with a zero balance; a bank is archived when all its accounts are; an account's currency cannot change once it has movements; a negative balance (for example after deleting an income that funded a transfer) is shown in red, never blocked.

## Forms, tables and opening balance (stage 2)

- The "Medio" radio becomes a "Cuenta" select: active accounts of the chosen currency only, reset when the currency changes, preselected when there is exactly one, and a hint linking to "crear cuenta" when there is none.
- The "own card forces DIGITAL" rule disappears; the account is always chosen explicitly.
- `CashMarker` becomes a "Cuenta" column ("Banco · Cuenta"), which also feeds the search.
- The opening-balance drawer has one row per account (grouped by bank) instead of two fields per currency.
- The migration drops `medium` outright: the financial tables are empty, so nothing is translated.

## Summary (stage 2 and 3)

Per currency, as today: **Anterior** (sum of the accounts' balances at the start of the month), **Actual** (sum of the accounts' balances now), **Objetivo** (Actual + pending incomes − pending expenses, same `includeExpectedIncomes` option). Stage 3 adds the **"Por cuenta"** card: the balance of each account, grouped by bank.

## Transfers (stage 3)

- Create validates: both accounts are the user's and active, same currency, different, amount > 0, date not in the future (Argentine time), and **sufficient funds in the source account at the transfer date** (reusing the balance computation).
- Check and insert happen in one transaction that locks the source account row, so two concurrent transfers cannot spend the same money. Editing re-validates; deleting is allowed (also in bulk).
- The funds check only runs when a transfer is created or edited.
- Table (like Incomes/Expenses, with the shared `DataTable`, selection and filters): date, source (account · bank), destination, amount, currency, notes; filters by search, month, account and currency; Actions menu with "Crear transferencia".

## Errors

Field errors follow the existing action-result shape. Domain errors, in Spanish: insufficient funds in the source account, archived account, currency mismatch, same account on both sides, future date. Services stay scoped by `userId`; an id belonging to another user behaves as not found.

## Testing

Strict TDD with Vitest, as in the rest of the repo: pure balance/summary computation first (including the transfer-neutrality property: any transfer leaves each currency total unchanged), then services with the Prisma mock, schemas, actions and components. The component-structure guard test applies to the new components.

## Out of scope

Cross-currency transfers, transfer fees, planned/future transfers, linking credit cards to a bank or account, per-account benefits/notes, importing statements.
